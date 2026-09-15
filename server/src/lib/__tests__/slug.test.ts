import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { slugify, uniqueSlug } from '../slug';

describe('slugify', () => {
  it('retire accents et ponctuation', () => {
    assert.equal(slugify('Chargeur Téléphone 20W'), 'chargeur-telephone-20w');
    assert.equal(slugify('Hoco C12 — Double USB 2.4A'), 'hoco-c12-double-usb-2-4a');
  });

  it('ne laisse jamais de tiret en tête ou en queue', () => {
    assert.equal(slugify('  ---Pack 10---  '), 'pack-10');
  });

  it('renvoie une chaîne vide pour un texte sans caractère utilisable', () => {
    assert.equal(slugify('باقة'), '');
  });
});

describe('uniqueSlug', () => {
  it('garde le slug de base quand il est libre', async () => {
    assert.equal(await uniqueSlug('Pack 10', async () => false), 'pack-10');
  });

  it('suffixe jusqu\'à trouver un slug libre', async () => {
    const pris = new Set(['pack-10', 'pack-10-2', 'pack-10-3']);
    assert.equal(await uniqueSlug('Pack 10', async (s) => pris.has(s)), 'pack-10-4');
  });

  it('retombe sur « item » quand le nom ne donne aucun slug', async () => {
    assert.equal(await uniqueSlug('باقة', async () => false), 'item');
  });
});
