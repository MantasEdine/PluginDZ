import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanTag, deriveAttribution } from '../attribution';

describe('cleanTag', () => {
  it('normalise une étiquette de campagne saisie à la main', () => {
    assert.equal(cleanTag('Promo Octobre 2026'), 'promo-octobre-2026');
    assert.equal(cleanTag('Soldes ÉTÉ'), 'soldes-ete');
  });

  it('écarte les caractères qui ne survivent pas à une URL', () => {
    assert.equal(cleanTag('promo/été?<script>'), 'promoetescript');
  });

  it('renvoie null pour une valeur vide ou inutilisable', () => {
    assert.equal(cleanTag(''), null);
    assert.equal(cleanTag(null), null);
    assert.equal(cleanTag(undefined), null);
    assert.equal(cleanTag('!!!'), null);
  });

  it('tronque pour ne pas laisser un paramètre géant entrer en base', () => {
    assert.equal(cleanTag('a'.repeat(200))!.length, 60);
  });
});

describe('deriveAttribution', () => {
  it('donne la priorité aux UTM explicites', () => {
    assert.deepEqual(
      deriveAttribution({ source: 'TikTok', medium: 'Social', campaign: 'Promo Octobre' }),
      { source: 'tiktok', medium: 'social', campaign: 'promo-octobre' },
    );
  });

  it('déduit google/cpc d\'un gclid seul', () => {
    assert.deepEqual(deriveAttribution({ gclid: 'abc123' }), {
      source: 'google', medium: 'cpc', campaign: null,
    });
  });

  it('déduit facebook/social d\'un fbclid seul', () => {
    assert.deepEqual(deriveAttribution({ fbclid: 'xyz' }), {
      source: 'facebook', medium: 'social', campaign: null,
    });
  });

  it('retombe sur le domaine référent, sans le « www. »', () => {
    assert.deepEqual(deriveAttribution({ referrer: 'https://www.google.com/search?q=chargeur' }), {
      source: 'google.com', medium: 'none', campaign: null,
    });
  });

  it('classe en « direct » une arrivée sans aucun indice', () => {
    assert.deepEqual(deriveAttribution({}), { source: 'direct', medium: 'none', campaign: null });
  });

  it('ignore un référent illisible plutôt que de planter', () => {
    assert.equal(deriveAttribution({ referrer: 'pas une url' }).source, 'direct');
  });

  it('produit la même étiquette pour une visite et pour la commande qui suit', () => {
    // C'est cette égalité, à l'octet près, qui permet de rapprocher les visites
    // d'une campagne et les ventes qu'elle a générées.
    const depuisVisite = deriveAttribution({ source: 'TikTok', campaign: 'Promo Octobre 2026' });
    const depuisCommande = deriveAttribution({ source: 'tiktok', campaign: 'promo-octobre-2026' });
    assert.deepEqual(depuisVisite, depuisCommande);
  });
});
