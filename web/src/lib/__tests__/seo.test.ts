import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { breadcrumbJsonLd, metaDescription, organizationJsonLd, packJsonLd, productJsonLd } from '../seo';
import { SOCIAL_LINKS } from '../contact';
import type { Pack, Product } from '../api';

/** Produit minimal, au plus près de ce que renvoie l'API. */
function product(over: Partial<Product> = {}): Product {
  return {
    id: 1, name: 'Hoco C12 Double USB', slug: 'hoco-c12', description: 'Chargeur double USB.',
    subType: null, imageUrl: null, isPromo: false, discountPercent: 0,
    minPrice: 950, maxPrice: 950, totalStock: 10,
    brand: { id: 1, name: 'Hoco', slug: 'hoco' },
    chargerType: { id: 1, name: 'Chargeur téléphone', slug: 'chargeur-telephone' },
    variants: [{ id: 1, label: 'Blanc', color: 'Blanc', power: null, plugType: null,
      price: 950, oldPrice: null, stock: 10, sku: 'HC12-W', imageUrl: null, isDefault: true }],
    ...over,
  } as unknown as Product;
}

describe('metaDescription', () => {
  it('utilise le texte du produit quand il existe', () => {
    assert.equal(metaDescription('Un bon chargeur.', 'secours'), 'Un bon chargeur.');
  });

  it('retombe sur le texte de secours si la description est vide', () => {
    assert.equal(metaDescription('   ', 'secours'), 'secours');
  });

  it('respecte la limite de 160 caractères des moteurs', () => {
    const out = metaDescription('a'.repeat(400), 'secours');
    assert.equal(out.length, 160);
    assert.ok(out.endsWith('...'));
  });

  it('écrase les retours à la ligne, qui casseraient la balise', () => {
    assert.equal(metaDescription('deux\n\nlignes', 'secours'), 'deux lignes');
  });
});

describe('productJsonLd', () => {
  it('déclare une Offer simple quand il n\'y a qu\'un prix', () => {
    const offers = productJsonLd(product()).offers as Record<string, unknown>;
    assert.equal(offers['@type'], 'Offer');
    assert.equal(offers.price, 950);
    assert.equal(offers.priceCurrency, 'DZD');
  });

  it('déclare une AggregateOffer quand les prix varient', () => {
    const offers = productJsonLd(product({ minPrice: 950, maxPrice: 1300 })).offers as Record<string, unknown>;
    assert.equal(offers['@type'], 'AggregateOffer');
    assert.equal(offers.lowPrice, 950);
    assert.equal(offers.highPrice, 1300);
  });

  it('annonce « en stock » ou « rupture » selon le stock réel', () => {
    const inStock = productJsonLd(product({ totalStock: 3 })).offers as Record<string, string>;
    const out = productJsonLd(product({ totalStock: 0 })).offers as Record<string, string>;
    assert.equal(inStock.availability, 'https://schema.org/InStock');
    assert.equal(out.availability, 'https://schema.org/OutOfStock');
  });

  it('expose la marque, que Google affiche dans le résultat', () => {
    const data = productJsonLd(product());
    assert.deepEqual(data.brand, { '@type': 'Brand', name: 'Hoco' });
  });

  it('reste sérialisable en JSON-LD', () => {
    assert.doesNotThrow(() => JSON.stringify(productJsonLd(product())));
  });
});

describe('packJsonLd', () => {
  it('donne un prix unique pour un lot', () => {
    const pack = { id: 1, name: 'Pack 10', slug: 'pack-10', description: 'Dix chargeurs.',
      imageUrl: null, price: 12500, stock: 4 } as unknown as Pack;
    const offers = packJsonLd(pack).offers as Record<string, unknown>;
    assert.equal(offers['@type'], 'Offer');
    assert.equal(offers.price, 12500);
    assert.equal(offers.availability, 'https://schema.org/InStock');
  });
});

describe('breadcrumbJsonLd', () => {
  it('numérote les niveaux à partir de 1', () => {
    const data = breadcrumbJsonLd([{ name: 'Accueil', path: '/' }, { name: 'Packs', path: '/packs' }]);
    const items = data.itemListElement as { position: number; name: string; item: string }[];
    assert.deepEqual(items.map((i) => i.position), [1, 2]);
    assert.ok(items[1].item.endsWith('/packs'));
  });
});

describe('organizationJsonLd', () => {
  it('rattache la boutique à ses trois réseaux', () => {
    // C'est ce lien qui évite que Google traite le site et ses pages sociales
    // comme quatre entités sans rapport.
    const sameAs = organizationJsonLd().sameAs as string[];
    assert.equal(sameAs.length, 3);
    assert.deepEqual(sameAs, SOCIAL_LINKS.map((s) => s.href));
  });

  it('publie le numéro WhatsApp au format international', () => {
    assert.equal(organizationJsonLd().telephone, '+213549982823');
  });
});
