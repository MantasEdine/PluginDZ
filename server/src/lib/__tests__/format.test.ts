import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDa, orderReference } from '../format';

describe('formatDa', () => {
  it('groupe les milliers avec une espace simple', () => {
    assert.equal(formatDa(950), '950 DA');
    assert.equal(formatDa(12500), '12 500 DA');
    assert.equal(formatDa(1000000), '1 000 000 DA');
  });

  it('n\'utilise pas d\'espace insécable', () => {
    // `toLocaleString` en produit, et il diffère entre Node et le navigateur :
    // l\'hydratation React casse alors sur un simple prix.
    assert.ok(!/[  ]/.test(formatDa(12500)));
  });

  it('gère zéro et les montants négatifs', () => {
    assert.equal(formatDa(0), '0 DA');
    assert.equal(formatDa(-2500), '-2 500 DA');
  });
});

describe('orderReference', () => {
  it('produit une référence lisible sur six chiffres', () => {
    assert.equal(orderReference(1), 'PLG-000001');
    assert.equal(orderReference(42), 'PLG-000042');
    assert.equal(orderReference(123456), 'PLG-123456');
  });

  it('ne tronque pas au-delà de six chiffres', () => {
    assert.equal(orderReference(1234567), 'PLG-1234567');
  });
});
