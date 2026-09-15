import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALGERIAN_PHONE, normalizePhone, samePhone } from '../phone';

describe('normalizePhone', () => {
  it('ramène toutes les écritures d\'un même numéro à la forme nationale', () => {
    for (const written of [
      '0661234567',
      '06 61 23 45 67',
      '0661.23.45.67',
      '0661-23-45-67',
      '+213661234567',
      '+213 661 23 45 67',
      '00213661234567',
      '213661234567',
      '(0661) 234567',
    ]) {
      assert.equal(normalizePhone(written), '0661234567', `écriture : ${written}`);
    }
  });

  it('laisse intacte une saisie déjà canonique', () => {
    assert.equal(normalizePhone('0770112233'), '0770112233');
  });

  it('ne casse pas une saisie non reconnue, elle la nettoie seulement', () => {
    assert.equal(normalizePhone('12 34'), '1234');
    assert.equal(normalizePhone(''), '');
  });

  it('ne confond pas un préfixe « 213 » qui fait partie du numéro', () => {
    // 10 chiffres commençant par 213 : ce n'est pas un indicatif, on n'y touche pas.
    assert.equal(normalizePhone('2131234567'), '2131234567');
  });
});

describe('samePhone', () => {
  it('reconnaît le même abonné à travers les formats', () => {
    assert.ok(samePhone('+213661234567', '0661234567'));
    assert.ok(samePhone('00213 661 23 45 67', '0661-23-45-67'));
  });

  it('distingue deux abonnés différents', () => {
    assert.ok(!samePhone('0661234567', '0661234568'));
    // Le garde-fou du suivi de commande : un chiffre de moins ne doit pas passer.
    assert.ok(!samePhone('0661234567', '066123456'));
  });
});

describe('ALGERIAN_PHONE', () => {
  it('accepte les trois opérateurs après normalisation', () => {
    for (const prefix of ['05', '06', '07']) {
      assert.ok(ALGERIAN_PHONE.test(`${prefix}61234567`), prefix);
    }
  });

  it('refuse les numéros manifestement invalides', () => {
    for (const bad of ['0461234567', '066123456', '06612345678', '0661234abc', '']) {
      assert.ok(!ALGERIAN_PHONE.test(bad), bad);
    }
  });

  it('accepte la forme internationale telle quelle', () => {
    assert.ok(ALGERIAN_PHONE.test('+213661234567'));
    assert.ok(ALGERIAN_PHONE.test('00213661234567'));
  });
});
