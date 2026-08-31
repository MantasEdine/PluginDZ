export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "plugin_lang";

export function isLocale(value: unknown): value is Locale {
  return value === "fr" || value === "ar";
}

export function dir(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Dictionnaire des libellés d'interface. Les données produits restent telles que saisies. */
const MESSAGES = {
  "nav.home": ["Accueil", "الرئيسية"],
  "nav.packs": ["Packs gros", "باقات الجملة"],
  "nav.products": ["Produits", "المنتجات"],
  "nav.brands": ["Marques", "العلامات"],
  "nav.promos": ["Promotions", "التخفيضات"],
  "nav.tracking": ["Suivi commande", "تتبع الطلب"],
  "nav.cart": ["Panier", "السلة"],
  "nav.admin": ["Administration", "الإدارة"],
  "nav.menu": ["Menu", "القائمة"],

  "home.heroTag": ["Gros & demi-gros", "بالجملة ونصف الجملة"],
  "home.heroTitle": [
    "Chargeurs en gros pour votre boutique",
    "شواحن بالجملة لمحلك",
  ],
  "home.heroText": [
    "Chargeurs téléphone, montre, caméra et vélo électrique. Prix revendeur, livraison dans les 58 wilayas via Yalidine.",
    "شواحن الهاتف والساعة والكاميرا والدراجة الكهربائية. أسعار الجملة والتوصيل إلى 58 ولاية عبر Yalidine.",
  ],
  "home.heroCta": ["Voir les packs", "اكتشف الباقات"],
  "home.heroCta2": ["Parcourir le catalogue", "تصفح الكتالوج"],
  "home.packs": ["Packs de gros", "باقات الجملة"],
  "home.packsSub": [
    "Achetez en volume, revendez au détail",
    "اشترِ بالجملة وبِع بالتجزئة",
  ],
  "home.promos": ["Promotions", "التخفيضات"],
  "home.promosSub": [
    "Les meilleures remises du moment",
    "أفضل التخفيضات حاليا",
  ],
  "home.brands": ["Nos marques", "علاماتنا"],
  "home.brandsSub": [
    "Choisissez une marque pour voir ses chargeurs",
    "اختر علامة لعرض شواحنها",
  ],
  "home.seeAll": ["Tout voir", "عرض الكل"],
  "home.arg1Title": ["Prix revendeur", "أسعار الجملة"],
  "home.arg1Text": [
    "Des tarifs dégressifs pensés pour les boutiques.",
    "أسعار تنازلية مدروسة للمحلات.",
  ],
  "home.arg2Title": ["58 wilayas", "58 ولاية"],
  "home.arg2Text": [
    "Livraison partout en Algérie via Yalidine.",
    "التوصيل لكل الجزائر عبر Yalidine.",
  ],
  "home.arg3Title": ["Paiement à la livraison", "الدفع عند الاستلام"],
  "home.arg3Text": [
    "Vous payez le colis à sa réception.",
    "تدفع ثمن الطرد عند استلامه.",
  ],

  "product.details": ["Détails", "التفاصيل"],
  "product.color": ["Couleur", "اللون"],
  "product.power": ["Puissance", "القدرة"],
  "product.plug": ["Type de prise", "نوع القابس"],
  "product.addToCart": ["Ajouter au panier", "أضف إلى السلة"],
  "product.added": ["Ajouté au panier", "أُضيف إلى السلة"],
  "product.inStock": ["En stock", "متوفر"],
  "product.lowStock": ["Stock limité", "الكمية محدودة"],
  "product.outOfStock": ["Rupture de stock", "نفدت الكمية"],
  "product.related": ["Produits similaires", "منتجات مشابهة"],
  "product.brand": ["Marque", "العلامة"],
  "product.type": ["Type", "النوع"],
  "product.reference": ["Référence", "المرجع"],
  "product.from": ["À partir de", "ابتداء من"],
  "product.quantity": ["Quantité", "الكمية"],

  "pack.title": ["Packs de gros", "باقات الجملة"],
  "pack.contains": ["Contenu du pack", "محتوى الباقة"],
  "pack.units": ["unités", "وحدة"],
  "pack.unitValue": ["Valeur au détail", "القيمة بالتجزئة"],
  "pack.savings": ["Vous économisez", "توفر"],
  "pack.available": ["packs disponibles", "باقة متوفرة"],
  "pack.empty": [
    "Aucun pack disponible pour le moment.",
    "لا توجد باقات متوفرة حاليا.",
  ],

  "list.filters": ["Filtres", "التصفية"],
  "list.allBrands": ["Toutes les marques", "كل العلامات"],
  "list.allTypes": ["Tous les types", "كل الأنواع"],
  "list.allSubTypes": ["Tous les sous-types", "كل الأصناف"],
  "list.sort": ["Trier", "ترتيب"],
  "list.sortRecent": ["Plus récents", "الأحدث"],
  "list.sortPriceAsc": ["Prix croissant", "السعر تصاعديا"],
  "list.sortPriceDesc": ["Prix décroissant", "السعر تنازليا"],
  "list.sortPromo": ["Meilleures remises", "أفضل التخفيضات"],
  "list.search": ["Rechercher un chargeur", "ابحث عن شاحن"],
  "list.results": ["résultat(s)", "نتيجة"],
  "list.empty": [
    "Aucun produit ne correspond à cette recherche.",
    "لا يوجد منتج يطابق البحث.",
  ],
  "list.reset": ["Réinitialiser", "إعادة تعيين"],
  "list.apply": ["Appliquer", "تطبيق"],
  "list.page": ["Page", "صفحة"],
  "list.prev": ["Précédent", "السابق"],
  "list.next": ["Suivant", "التالي"],

  "brand.products": ["produits", "منتجات"],
  "brand.types": ["Types disponibles", "الأنواع المتوفرة"],
  "brand.empty": [
    "Cette marque n’a aucun produit en stock.",
    "لا توجد منتجات متوفرة لهذه العلامة.",
  ],

  "cart.title": ["Mon panier", "سلتي"],
  "cart.empty": ["Votre panier est vide.", "سلتك فارغة."],
  "cart.continue": ["Continuer mes achats", "مواصلة التسوق"],
  "cart.total": ["Total", "المجموع"],
  "cart.checkout": ["Passer la commande", "إتمام الطلب"],
  "cart.remove": ["Retirer", "حذف"],
  "cart.unitPrice": ["Prix unitaire", "سعر الوحدة"],
  "cart.pack": ["Pack", "باقة"],

  "checkout.title": ["Finaliser la commande", "إتمام الطلب"],
  "checkout.intro": [
    "Aucun paiement en ligne : nous vous rappelons pour confirmer, puis le colis part via Yalidine.",
    "لا يوجد دفع إلكتروني: نتصل بك للتأكيد ثم يُرسل الطرد عبر Yalidine.",
  ],
  "checkout.name": ["Nom et prénom", "الاسم واللقب"],
  "checkout.phone": ["Téléphone", "رقم الهاتف"],
  "checkout.wilaya": ["Wilaya", "الولاية"],
  "checkout.address": ["Adresse de livraison", "عنوان التوصيل"],
  "checkout.note": ["Note (facultatif)", "ملاحظة (اختياري)"],
  "checkout.selectWilaya": ["Choisir une wilaya", "اختر الولاية"],
  "checkout.submit": ["Confirmer la commande", "تأكيد الطلب"],
  "checkout.sending": ["Envoi en cours...", "جاري الإرسال..."],
  "checkout.summary": ["Récapitulatif", "ملخص الطلب"],

  "confirm.title": ["Commande reçue", "تم استلام الطلب"],
  "confirm.text": [
    "Merci ! Nous vous appelons rapidement pour confirmer la livraison.",
    "شكرا! سنتصل بك قريبا لتأكيد التوصيل.",
  ],
  "confirm.reference": ["Votre référence", "رقم طلبك"],
  "confirm.noReference": [
    "Votre commande a bien été enregistrée, mais nous n’avons pas pu afficher votre référence ici. Contactez-nous pour la recevoir :",
    "تم تسجيل طلبك بنجاح، لكن تعذّر عرض رقم الطلب هنا. تواصل معنا للحصول عليه:",
  ],
  "confirm.back": ["Retour à la boutique", "العودة إلى المتجر"],

  "tracking.title": ["Suivre ma commande", "تتبع طلبي"],
  "tracking.intro": [
    "Saisissez votre référence et votre téléphone.",
    "أدخل رقم طلبك ورقم هاتفك.",
  ],
  "tracking.submit": ["Rechercher", "بحث"],
  "tracking.status": ["Statut", "الحالة"],

  "status.nouveau": ["Nouvelle", "جديد"],
  "status.confirme": ["Confirmée", "مؤكد"],
  "status.expedie": ["Expédiée", "تم الشحن"],
  "status.annule": ["Annulée", "ملغى"],

  "common.loading": ["Chargement...", "جاري التحميل..."],
  "common.error": ["Une erreur est survenue.", "حدث خطأ."],
  "common.required": ["Champ obligatoire", "حقل إجباري"],
  "common.contact": ["Contact", "اتصل بنا"],
  "common.rights": ["Tous droits réservés.", "كل الحقوق محفوظة."],
  "common.tagline": ["Chargeurs en gros — Algérie", "شواحن بالجملة — الجزائر"],
} as const;

export type MessageKey = keyof typeof MESSAGES;

export function translate(locale: Locale, key: MessageKey): string {
  const entry = MESSAGES[key];
  return locale === "ar" ? entry[1] : entry[0];
}

/** Fabrique un `t()` lié à une langue. */
export function translator(locale: Locale) {
  return (key: MessageKey) => translate(locale, key);
}
