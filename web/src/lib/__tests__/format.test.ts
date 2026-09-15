import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDa } from '../format';

const NBSP = ' ';

describe('formatDa', () => {
  it('affiche les dinars en français', () => {
    assert.equal(formatDa(950), `950${NBSP}DA`);
    assert.equal(formatDa(12500), `12${NBSP}500${NBSP}DA`);
  });

  it('affiche les dinars en arabe', () => {
    assert.equal(formatDa(12500, 'ar'), `12${NBSP}500${NBSP}دج`);
  });

  it('groupe les milliers de façon identique côté serveur et côté navigateur', () => {
    // Le groupement est fait à la main précisément pour que le rendu serveur et le
    // rendu client soient identiques : sinon React signale une erreur d'hydratation
    // sur chaque prix affiché.
    assert.equal(formatDa(1000000), `1${NBSP}000${NBSP}000${NBSP}DA`);
    assert.equal(formatDa(100), `100${NBSP}DA`);
    assert.equal(formatDa(1000), `1${NBSP}000${NBSP}DA`);
  });

  it('gère zéro', () => {
    assert.equal(formatDa(0), `0${NBSP}DA`);
  });

  it('tronque les centimes : les prix sont des entiers en DA', () => {
    assert.equal(formatDa(1299.9), `1${NBSP}299${NBSP}DA`);
  });
});
