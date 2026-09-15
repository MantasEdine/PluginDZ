import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidWilaya, WILAYAS } from '../wilayas';

describe('WILAYAS', () => {
  it('couvre les 69 wilayas du découpage en vigueur', () => {
    assert.equal(WILAYAS.length, 69);
  });

  it('numérote sans trou de 1 à 69', () => {
    assert.deepEqual(
      WILAYAS.map((w) => w.code),
      Array.from({ length: 69 }, (_, i) => i + 1),
    );
  });

  it('ne contient aucun doublon de nom', () => {
    const names = WILAYAS.map((w) => w.name);
    assert.equal(new Set(names).size, names.length);
  });

  it('inclut les wilayas créées par la loi 26-06', () => {
    // Sans elles, ces clients ne peuvent tout simplement pas commander.
    const names = WILAYAS.map((w) => w.name);
    for (const created of ['Aflou', 'Barika', 'Bou Saâda', 'El Abiodh Sidi Cheikh']) {
      assert.ok(names.includes(created), created);
    }
  });

  it('n\'a ni nom vide ni espace superflu', () => {
    for (const w of WILAYAS) {
      assert.ok(w.name.length > 0, `code ${w.code}`);
      assert.equal(w.name, w.name.trim(), `code ${w.code}`);
    }
  });
});

describe('isValidWilaya', () => {
  it('accepte une wilaya historique comme une wilaya récente', () => {
    assert.ok(isValidWilaya('Alger'));
    assert.ok(isValidWilaya('El Abiodh Sidi Cheikh'));
  });

  it('refuse ce qui n\'est pas une wilaya', () => {
    for (const bad of ['Paris', '', 'alger ', 'Wilaya inventée']) {
      assert.ok(!isValidWilaya(bad), JSON.stringify(bad));
    }
  });
});
