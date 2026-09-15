import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OrderStatus } from '@prisma/client';
import { LOST_STATUSES, releasesStock, REVENUE_STATUSES } from '../order-status';

describe('releasesStock', () => {
  it('rend la marchandise au rayon pour une annulation et pour un retour', () => {
    assert.ok(releasesStock(OrderStatus.annule));
    assert.ok(releasesStock(OrderStatus.retourne));
  });

  it('garde le stock réservé tant que la commande vit', () => {
    for (const status of [OrderStatus.nouveau, OrderStatus.confirme, OrderStatus.expedie, OrderStatus.livre]) {
      assert.ok(!releasesStock(status), status);
    }
  });
});

describe('REVENUE_STATUSES', () => {
  it('compte la commande livrée — le seul encaissement certain', () => {
    assert.ok(REVENUE_STATUSES.includes(OrderStatus.livre));
  });

  it('exclut le colis refusé à la livraison : il n\'a jamais rapporté un dinar', () => {
    assert.ok(!REVENUE_STATUSES.includes(OrderStatus.retourne));
    assert.ok(!REVENUE_STATUSES.includes(OrderStatus.annule));
  });

  it('ne compte pas une commande qui n\'a pas encore été confirmée', () => {
    assert.ok(!REVENUE_STATUSES.includes(OrderStatus.nouveau));
  });
});

describe('cohérence des deux ensembles', () => {
  it('aucun statut ne peut à la fois rapporter de l\'argent et être une vente perdue', () => {
    const overlap = REVENUE_STATUSES.filter((s) => LOST_STATUSES.includes(s));
    assert.deepEqual(overlap, []);
  });

  it('tout statut qui rend le stock est une vente perdue, et réciproquement', () => {
    const releasing = Object.values(OrderStatus).filter(releasesStock).sort();
    assert.deepEqual(releasing, [...LOST_STATUSES].sort());
  });

  it('chaque statut du schéma est classé quelque part', () => {
    // Filet de sécurité : ajouter un statut sans décider s'il rapporte de l'argent
    // ou non fera échouer ce test plutôt que fausser silencieusement le chiffre.
    const known = new Set<string>([
      OrderStatus.nouveau,
      ...REVENUE_STATUSES,
      ...LOST_STATUSES,
    ]);
    for (const status of Object.values(OrderStatus)) {
      assert.ok(known.has(status), `statut non classé : ${status}`);
    }
  });
});
