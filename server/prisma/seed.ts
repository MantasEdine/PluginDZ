import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/env';
import { slugify } from '../src/lib/slug';

const prisma = new PrismaClient();

const BRANDS = ['Hoco', 'Baseus', 'Oppo', 'Samsung', 'Anker', 'Xiaomi', 'Sony'];
const TYPES = [
  ['Chargeur téléphone', 0],
  ['Chargeur montre', 1],
  ['Chargeur caméra', 2],
  ['Chargeur vélo électrique', 3],
  ['Chargeur voiture', 4],
] as const;

type Seed = {
  name: string; brand: string; type: string; subType?: string; promo?: boolean;
  desc: string; variants: { color?: string; power?: string; plug?: string; price: number; old?: number; stock: number }[];
};

const PRODUCTS: Seed[] = [
  { name: 'Hoco C12 Double USB 2.4A', brand: 'Hoco', type: 'Chargeur téléphone', subType: 'Type-C', promo: true,
    desc: "Chargeur mural double port USB 2.4A. Protection contre la surcharge et la surchauffe. Compatible Android et iPhone. Câble Type-C d'un mètre inclus.",
    variants: [ { color: 'Blanc', power: '12W', plug: 'EU', price: 950, old: 1300, stock: 240 }, { color: 'Noir', power: '12W', plug: 'EU', price: 950, old: 1300, stock: 180 } ] },
  { name: 'Hoco N7 PD 20W', brand: 'Hoco', type: 'Chargeur téléphone', subType: 'iPhone', promo: true,
    desc: 'Chargeur rapide PD 20W pour iPhone 8 à 15. Charge 50% en 30 minutes. Boîtier compact, prise européenne.',
    variants: [ { color: 'Blanc', power: '20W', plug: 'EU', price: 1400, old: 1900, stock: 320 }, { color: 'Noir', power: '20W', plug: 'EU', price: 1400, old: 1900, stock: 95 } ] },
  { name: 'Baseus GaN5 65W', brand: 'Baseus', type: 'Chargeur téléphone', subType: 'Type-C',
    desc: 'Chargeur GaN 65W trois ports (2×USB-C + USB-A). Alimente un téléphone, une tablette et un ordinateur portable. Technologie GaN pour un format réduit.',
    variants: [ { color: 'Noir', power: '65W', plug: 'EU', price: 5200, stock: 60 }, { color: 'Blanc', power: '65W', plug: 'EU', price: 5200, stock: 40 }, { color: 'Noir', power: '45W', plug: 'EU', price: 3900, stock: 75 } ] },
  { name: 'Oppo SuperVOOC 67W', brand: 'Oppo', type: 'Chargeur téléphone', subType: 'Type-C',
    desc: 'Chargeur SuperVOOC 67W officiel Oppo. Charge complète en 35 minutes sur Reno et Find. Câble Type-C 6A inclus.',
    variants: [ { color: 'Blanc', power: '67W', plug: 'EU', price: 4300, stock: 110 } ] },
  { name: 'Samsung EP-TA800 25W', brand: 'Samsung', type: 'Chargeur téléphone', subType: 'Type-C', promo: true,
    desc: 'Chargeur secteur Samsung 25W Super Fast Charging. Compatible Galaxy S et Note. Norme USB Power Delivery PPS.',
    variants: [ { color: 'Noir', power: '25W', plug: 'EU', price: 2100, old: 2600, stock: 150 } ] },
  { name: 'Anker PowerPort III Nano 20W', brand: 'Anker', type: 'Chargeur téléphone',
    desc: 'Le plus petit chargeur 20W de sa catégorie. Circuit MultiProtect et boîtier ignifugé. Garantie constructeur 18 mois.',
    variants: [ { color: 'Blanc', power: '20W', plug: 'EU', price: 2400, stock: 85 } ] },
  { name: 'Xiaomi Mi 33W Turbo', brand: 'Xiaomi', type: 'Chargeur téléphone', subType: 'Type-C',
    desc: 'Chargeur Turbo Charge 33W pour Redmi Note et Poco. Double protocole QC et PD.',
    variants: [ { color: 'Blanc', power: '33W', plug: 'EU', price: 2200, stock: 130 } ] },
  { name: 'Hoco Y1 Chargeur montre magnétique', brand: 'Hoco', type: 'Chargeur montre',
    desc: 'Socle magnétique pour montres connectées. Câble USB 1 m intégré. Charge complète en 90 minutes.',
    variants: [ { color: 'Blanc', price: 1100, stock: 200 }, { color: 'Noir', price: 1100, stock: 160 } ] },
  { name: 'Samsung Galaxy Watch chargeur sans fil', brand: 'Samsung', type: 'Chargeur montre', promo: true,
    desc: 'Socle de charge sans fil pour Galaxy Watch 4, 5 et 6. Connecteur USB-C.',
    variants: [ { color: 'Noir', price: 1800, old: 2400, stock: 70 } ] },
  { name: 'Baseus chargeur Apple Watch USB-C', brand: 'Baseus', type: 'Chargeur montre', subType: 'iPhone',
    desc: 'Chargeur magnétique certifié pour Apple Watch série 1 à 9. Format porte-clés, idéal en déplacement.',
    variants: [ { color: 'Blanc', price: 1600, stock: 90 } ] },
  { name: 'Sony chargeur batterie NP-FZ100', brand: 'Sony', type: 'Chargeur caméra',
    desc: "Chargeur double emplacement pour batteries NP-FZ100 (Alpha 7 III, A7R IV). Écran LCD indiquant l'état de charge.",
    variants: [ { power: '2 batteries', price: 6500, stock: 25 } ] },
  { name: 'Chargeur universel caméra LP-E6', brand: 'Hoco', type: 'Chargeur caméra',
    desc: 'Chargeur secteur et allume-cigare pour batteries LP-E6 Canon. Coupure automatique en fin de charge.',
    variants: [ { price: 3200, stock: 40 } ] },
  { name: 'Chargeur vélo électrique 48V 2A', brand: 'Hoco', type: 'Chargeur vélo électrique', promo: true,
    desc: "Chargeur 48V 2A pour vélos et trottinettes électriques. Connecteur XLR 3 broches. Ventilateur silencieux et protection contre l'inversion de polarité.",
    variants: [ { power: '48V 2A', plug: 'EU', price: 4800, old: 6000, stock: 55 } ] },
  { name: 'Chargeur trottinette 36V 2A', brand: 'Baseus', type: 'Chargeur vélo électrique',
    desc: 'Chargeur 36V 2A compatible Xiaomi M365, Pro et Ninebot. Voyant LED rouge/vert.',
    variants: [ { power: '36V 2A', plug: 'EU', price: 3900, stock: 65 } ] },
  { name: 'Hoco Z39 chargeur voiture 18W', brand: 'Hoco', type: 'Chargeur voiture',
    desc: 'Chargeur allume-cigare double port avec affichage de la tension batterie. Charge rapide QC 3.0.',
    variants: [ { color: 'Noir', power: '18W', price: 1300, stock: 210 }, { color: 'Gris', power: '18W', price: 1300, stock: 120 } ] },
];

const PACKS = [
  { name: 'Pack 10 Chargeurs iPhone Hoco N7 20W', price: 12500, old: 14000, stock: 30, featured: true,
    desc: 'Le pack de référence pour les revendeurs : 10 chargeurs PD 20W blancs, prêts à la revente.', pick: ['Hoco N7 PD 20W', 10] as const },
  { name: 'Pack 20 Chargeurs Hoco C12 Double USB', price: 16000, old: 19000, stock: 25, featured: true,
    desc: '20 chargeurs double USB 2.4A, le best-seller en boutique. Marge confortable au détail.', pick: ['Hoco C12 Double USB 2.4A', 20] as const },
  { name: 'Pack 12 Chargeurs montre Hoco Y1', price: 11000, stock: 20, featured: true,
    desc: '12 socles magnétiques universels pour montres connectées.', pick: ['Hoco Y1 Chargeur montre magnétique', 12] as const },
  { name: 'Pack 6 Chargeurs vélo électrique 48V', price: 25000, old: 28800, stock: 12,
    desc: '6 chargeurs 48V 2A pour vélos et trottinettes. Forte demande, faible concurrence.', pick: ['Chargeur vélo électrique 48V 2A', 6] as const },
  { name: 'Pack 15 Chargeurs voiture Hoco Z39', price: 16500, stock: 18,
    desc: '15 chargeurs allume-cigare QC 3.0 avec voltmètre.', pick: ['Hoco Z39 chargeur voiture 18W', 15] as const },
];

async function main() {
  console.info('Nettoyage...');
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.packItem.deleteMany();
  await prisma.pack.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.chargerType.deleteMany();

  const brands = new Map<string, number>();
  for (const name of BRANDS) {
    const brand = await prisma.brand.create({ data: { name, slug: slugify(name) } });
    brands.set(name, brand.id);
  }

  const types = new Map<string, number>();
  for (const [name, position] of TYPES) {
    const type = await prisma.chargerType.create({ data: { name, slug: slugify(name), position } });
    types.set(name, type.id);
  }

  const variantByProduct = new Map<string, number>();
  for (const item of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        name: item.name,
        slug: slugify(item.name),
        brandId: brands.get(item.brand)!,
        chargerTypeId: types.get(item.type)!,
        subType: item.subType ?? null,
        description: item.desc,
        isPromo: item.promo ?? false,
        variants: {
          create: item.variants.map((v, index) => ({
            color: v.color ?? null,
            power: v.power ?? null,
            plugType: v.plug ?? null,
            price: v.price,
            oldPrice: v.old ?? null,
            stock: v.stock,
            isDefault: index === 0,
          })),
        },
      },
      include: { variants: true },
    });
    variantByProduct.set(item.name, product.variants[0]!.id);
  }

  for (const pack of PACKS) {
    await prisma.pack.create({
      data: {
        name: pack.name,
        slug: slugify(pack.name),
        price: pack.price,
        oldPrice: pack.old ?? null,
        description: pack.desc,
        stock: pack.stock,
        isFeatured: pack.featured ?? false,
        items: { create: [{ variantId: variantByProduct.get(pack.pick[0])!, quantity: pack.pick[1] }] },
      },
    });
  }

  await prisma.adminUser.upsert({
    where: { email: env.owner.email },
    update: {},
    create: {
      email: env.owner.email,
      name: env.owner.name,
      passwordHash: await bcrypt.hash(env.owner.password, 10),
      role: 'owner',
    },
  });

  console.info(`OK : ${BRANDS.length} marques, ${TYPES.length} types, ${PRODUCTS.length} produits, ${PACKS.length} packs.`);
  console.info(`Compte propriétaire : ${env.owner.email} / ${env.owner.password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
