import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SOCIAL_LINKS, WHATSAPP_DISPLAY, WHATSAPP_NUMBER, whatsappLink } from '../contact';

describe('WHATSAPP_NUMBER', () => {
  it('est au format attendu par wa.me : chiffres seuls, sans « + »', () => {
    assert.match(WHATSAPP_NUMBER, /^\d{11,15}$/);
  });

  it('correspond bien au numéro affiché aux clients', () => {
    assert.equal(WHATSAPP_DISPLAY.replace(/[^\d]/g, ''), WHATSAPP_NUMBER);
  });
});

describe('whatsappLink', () => {
  it('ouvre une conversation avec la boutique', () => {
    assert.equal(whatsappLink(), `https://wa.me/${WHATSAPP_NUMBER}`);
  });

  it('encode le message pré-rempli', () => {
    const link = whatsappLink("Bonjour, j'ai une question");
    assert.ok(link.startsWith(`https://wa.me/${WHATSAPP_NUMBER}?text=`));
    // Une espace brute couperait l'URL : le message arriverait tronqué.
    assert.ok(!/\s/.test(link), link);
    assert.ok(link.includes('%20'));
    // L'apostrophe est un caractère autorisé en URL : encodeURIComponent la
    // laisse telle quelle, et WhatsApp l'affiche correctement.
    assert.ok(link.includes("j'ai"));
  });

  it('encode aussi l\'arabe', () => {
    assert.ok(!/[؀-ۿ]/.test(whatsappLink('مرحبا')));
  });
});

describe('SOCIAL_LINKS', () => {
  it('couvre les trois réseaux de la boutique', () => {
    assert.deepEqual(SOCIAL_LINKS.map((s) => s.key), ['facebook', 'instagram', 'tiktok']);
  });

  it('n\'utilise que des URL https canoniques', () => {
    for (const social of SOCIAL_LINKS) {
      assert.ok(social.href.startsWith('https://'), social.href);
      // Les URL copiées depuis l'application traînent des paramètres de partage
      // qui identifient la session de celui qui a copié le lien.
      assert.ok(!/mibextid|rdid|share_url|_rdc|_rdr/.test(social.href), social.href);
    }
  });
});
