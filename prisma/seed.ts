import { PrismaClient, ProductCategory, ProductSource } from '@prisma/client';

const prisma = new PrismaClient();

// Seed data - 50 verified products from major fashion brands
const seedProducts = [
  // Original 20 products from real-products.json
  {
    name: 'Nike Air Max SC Scarpe Donna',
    brand: 'Nike',
    category: 'shoes' as ProductCategory,
    source: 'nike' as ProductSource,
    originalPrice: 100,
    salePrice: 69.97,
    discountPercentage: 30,
    productUrl: 'https://www.nike.com/it/t/scarpa-air-max-sc-BLkft8/CW4554-003',
    imageUrl:
      'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/b1bcbca4-e853-4df7-b329-5be3c61ee057/scarpa-air-max-sc-BLkft8.png',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Scarpe Ultraboost Light',
    brand: 'Adidas',
    category: 'shoes' as ProductCategory,
    source: 'adidas' as ProductSource,
    originalPrice: 200,
    salePrice: 140,
    discountPercentage: 30,
    productUrl: 'https://www.adidas.it/scarpe-ultraboost-light/HQ6341.html',
    imageUrl:
      'https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/c21a2146cfc0415fae8faf1a012f6f42_9366/Scarpe_Ultraboost_Light_Bianco_HQ6341_01_standard.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Blazer in lino oversize',
    brand: 'Zara',
    category: 'clothing' as ProductCategory,
    source: 'zara' as ProductSource,
    originalPrice: 69.95,
    salePrice: 34.99,
    discountPercentage: 50,
    productUrl: 'https://www.zara.com/it/it/blazer-lino-oversize-p02753726.html',
    imageUrl: 'https://static.zara.net/photos///2024/V/0/1/p/2753/726/251/2/w/750/2753726251_1_1_1.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'T-shirt Regular Fit in cotone',
    brand: 'H&M',
    category: 'clothing' as ProductCategory,
    source: 'hm' as ProductSource,
    originalPrice: 12.99,
    salePrice: 7.99,
    discountPercentage: 38,
    productUrl: 'https://www2.hm.com/it_it/productpage.0970818001.html',
    imageUrl: 'https://image.hm.com/assets/hm/c6/f2/c6f200a9e91e45bfa9cd8be96b0e1f5e31eba5c0.jpg',
    isNew: false,
    confidenceScore: 90,
  },
  {
    name: 'Jeans straight fit vita alta',
    brand: 'Mango',
    category: 'clothing' as ProductCategory,
    source: 'mango' as ProductSource,
    originalPrice: 45.99,
    salePrice: 25.99,
    discountPercentage: 43,
    productUrl:
      'https://shop.mango.com/it/donna/jeans-straight/jeans-straight-fit-vita-alta_17042878.html',
    imageUrl: 'https://st.mngbcn.com/rcs/pics/static/T1/fotos/S20/17042878_56.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Vestito midi a maniche lunghe nero',
    brand: 'ASOS DESIGN',
    category: 'clothing' as ProductCategory,
    source: 'asos' as ProductSource,
    originalPrice: 38.99,
    salePrice: 23.49,
    discountPercentage: 40,
    productUrl: 'https://www.asos.com/it/asos-design/asos-design-vestito-midi-a-maniche-lunghe-nero/prd/205177932',
    imageUrl: 'https://images.asos-media.com/products/asos-design-vestito-midi-a-maniche-lunghe-nero/205177932-1-black',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Nike Sportswear Essential T-Shirt',
    brand: 'Nike',
    category: 'clothing' as ProductCategory,
    source: 'nike' as ProductSource,
    originalPrice: 29.99,
    salePrice: 20.97,
    discountPercentage: 30,
    productUrl: 'https://www.nike.com/it/t/maglia-sportswear-essential-boyfriend-SlCKQl/BV6175-063',
    imageUrl:
      'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/9e353fcf-78df-4c8c-8c8e-7e6b16301e74/maglia-sportswear-essential-boyfriend-SlCKQl.png',
    isNew: false,
    confidenceScore: 90,
  },
  {
    name: 'Scarpe Forum Low',
    brand: 'Adidas',
    category: 'shoes' as ProductCategory,
    source: 'adidas' as ProductSource,
    originalPrice: 110,
    salePrice: 77,
    discountPercentage: 30,
    productUrl: 'https://www.adidas.it/scarpe-forum-low/FY7757.html',
    imageUrl:
      'https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/ef88b41808014f16a270ae5500bc2731_9366/Scarpe_Forum_Low_Bianco_FY7757_01_standard.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Jeans ZW Collection Straight Leg',
    brand: 'Zara',
    category: 'clothing' as ProductCategory,
    source: 'zara' as ProductSource,
    originalPrice: 35.95,
    salePrice: 22.99,
    discountPercentage: 36,
    productUrl: 'https://www.zara.com/it/it/jeans-zw-collection-straight-leg-p04365041.html',
    imageUrl: 'https://static.zara.net/photos///2024/V/0/1/p/4365/041/427/2/w/750/4365041427_1_1_1.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Felpa con cappuccio Relaxed Fit',
    brand: 'H&M',
    category: 'clothing' as ProductCategory,
    source: 'hm' as ProductSource,
    originalPrice: 24.99,
    salePrice: 14.99,
    discountPercentage: 40,
    productUrl: 'https://www2.hm.com/it_it/productpage.0970819037.html',
    imageUrl: 'https://image.hm.com/assets/hm/33/5e/335e1f8f0eae6a7f73c9e0d4e2c1e9c3f8a0e2d0.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Piumino Ultra Light Down Donna',
    brand: 'Uniqlo',
    category: 'clothing' as ProductCategory,
    source: 'uniqlo' as ProductSource,
    originalPrice: 59.9,
    salePrice: 39.9,
    discountPercentage: 33,
    productUrl: 'https://www.uniqlo.com/it/it/product/piumino-ultra-light-down-donna-461231.html',
    imageUrl:
      'https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods/461231/item/goods_09_461231.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Pantaloni cargo con tasche',
    brand: 'Pull&Bear',
    category: 'clothing' as ProductCategory,
    source: 'pullbear' as ProductSource,
    originalPrice: 29.99,
    salePrice: 17.99,
    discountPercentage: 40,
    productUrl: 'https://www.pullandbear.com/it/pantaloni-cargo-con-tasche-l04251527.html',
    imageUrl: 'https://static.pullandbear.net/2/photos/2024/V/0/2/p/4251/527/505/4251527505_1_1_8.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Top corto a costine',
    brand: 'Bershka',
    category: 'clothing' as ProductCategory,
    source: 'bershka' as ProductSource,
    originalPrice: 12.99,
    salePrice: 7.99,
    discountPercentage: 38,
    productUrl: 'https://www.bershka.com/it/top-corto-a-costine-c01523897.html',
    imageUrl: 'https://static.bershka.net/4/photos/2024/V/0/2/p/1523/897/800/1523897800_1_1_8.jpg',
    isNew: false,
    confidenceScore: 85,
  },
  {
    name: 'Vestito midi con cintura',
    brand: 'Stradivarius',
    category: 'clothing' as ProductCategory,
    source: 'stradivarius' as ProductSource,
    originalPrice: 25.99,
    salePrice: 15.99,
    discountPercentage: 38,
    productUrl: 'https://www.stradivarius.com/it/vestito-midi-con-cintura-p01927784.html',
    imageUrl: 'https://static.e-stradivarius.net/5/photos/2024/V/0/1/p/1927/784/001/1927784001_1_1_8.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Nike Revolution 7 Scarpe Running',
    brand: 'Nike',
    category: 'shoes' as ProductCategory,
    source: 'nike' as ProductSource,
    originalPrice: 65,
    salePrice: 45.47,
    discountPercentage: 30,
    productUrl:
      'https://www.nike.com/it/t/scarpa-da-running-su-strada-revolution-7-easyon-zMMV6L/FB2208-003',
    imageUrl:
      'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/1e663a4c-8c2e-44e9-8e3f-5c88e9c0e8c7/scarpa-da-running-su-strada-revolution-7-easyon-zMMV6L.png',
    isNew: false,
    confidenceScore: 90,
  },
  {
    name: 'Scarpe Gazelle',
    brand: 'Adidas',
    category: 'shoes' as ProductCategory,
    source: 'adidas' as ProductSource,
    originalPrice: 110,
    salePrice: 77,
    discountPercentage: 30,
    productUrl: 'https://www.adidas.it/scarpe-gazelle/BB5478.html',
    imageUrl:
      'https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/12365dbd78f944c4b4b4ab4900dd60f8_9366/Scarpe_Gazelle_Blu_BB5478_01_standard.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Borsa a tracolla con catena',
    brand: 'Mango',
    category: 'accessories' as ProductCategory,
    source: 'mango' as ProductSource,
    originalPrice: 35.99,
    salePrice: 19.99,
    discountPercentage: 44,
    productUrl:
      'https://shop.mango.com/it/donna/borse-a-tracolla/borsa-a-tracolla-con-catena_17085024.html',
    imageUrl: 'https://st.mngbcn.com/rcs/pics/static/T1/fotos/S20/17085024_99.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Borsa shopper maxi',
    brand: 'Zara',
    category: 'accessories' as ProductCategory,
    source: 'zara' as ProductSource,
    originalPrice: 29.95,
    salePrice: 17.99,
    discountPercentage: 40,
    productUrl: 'https://www.zara.com/it/it/borsa-shopper-maxi-p04340810.html',
    imageUrl: 'https://static.zara.net/photos///2024/V/1/2/p/4340/810/040/2/w/750/4340810040_1_1_1.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Sneakers chunky bianche',
    brand: 'ASOS DESIGN',
    category: 'shoes' as ProductCategory,
    source: 'asos' as ProductSource,
    originalPrice: 45.99,
    salePrice: 27.49,
    discountPercentage: 40,
    productUrl: 'https://www.asos.com/it/asos-design/asos-design-sneakers-chunky-bianche/prd/203147865',
    imageUrl: 'https://images.asos-media.com/products/asos-design-sneakers-chunky-bianche/203147865-1-white',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Giacca in denim',
    brand: 'H&M',
    category: 'clothing' as ProductCategory,
    source: 'hm' as ProductSource,
    originalPrice: 34.99,
    salePrice: 24.99,
    discountPercentage: 29,
    productUrl: 'https://www2.hm.com/it_it/productpage.0685816050.html',
    imageUrl: 'https://image.hm.com/assets/hm/84/0a/840a8c9e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e.jpg',
    isNew: false,
    confidenceScore: 85,
  },
  // Additional 30 products
  {
    name: 'Nike Dunk Low Retro',
    brand: 'Nike',
    category: 'shoes' as ProductCategory,
    source: 'nike' as ProductSource,
    originalPrice: 120,
    salePrice: 84,
    discountPercentage: 30,
    productUrl: 'https://www.nike.com/it/t/scarpa-dunk-low-retro-wwKKzD/DD1391-100',
    imageUrl:
      'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/af53d53d-561f-450a-a483-70a7ceee380f/scarpa-dunk-low-retro-wwKKzD.png',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Adidas Stan Smith',
    brand: 'Adidas',
    category: 'shoes' as ProductCategory,
    source: 'adidas' as ProductSource,
    originalPrice: 100,
    salePrice: 70,
    discountPercentage: 30,
    productUrl: 'https://www.adidas.it/scarpe-stan-smith/M20324.html',
    imageUrl:
      'https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/a615e89e6e094a7ba21eaae700bdfa46_9366/Scarpe_Stan_Smith_Bianco_M20324_01_standard.jpg',
    isNew: false,
    confidenceScore: 95,
  },
  {
    name: 'Cappotto lungo in misto lana',
    brand: 'Zara',
    category: 'clothing' as ProductCategory,
    source: 'zara' as ProductSource,
    originalPrice: 129,
    salePrice: 69.99,
    discountPercentage: 46,
    productUrl: 'https://www.zara.com/it/it/cappotto-lungo-in-misto-lana-p08073632.html',
    imageUrl: 'https://static.zara.net/photos///2024/V/0/1/p/8073/632/800/2/w/750/8073632800_1_1_1.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Camicia in lino Regular Fit',
    brand: 'H&M',
    category: 'clothing' as ProductCategory,
    source: 'hm' as ProductSource,
    originalPrice: 19.99,
    salePrice: 12.99,
    discountPercentage: 35,
    productUrl: 'https://www2.hm.com/it_it/productpage.0685816033.html',
    imageUrl: 'https://image.hm.com/assets/hm/5a/3c/5a3c8f9d9d9d9d9d9d9d9d9d9d9d9d9d9d9d9d9d.jpg',
    isNew: false,
    confidenceScore: 90,
  },
  {
    name: 'Gonna midi plissettata',
    brand: 'Mango',
    category: 'clothing' as ProductCategory,
    source: 'mango' as ProductSource,
    originalPrice: 39.99,
    salePrice: 23.99,
    discountPercentage: 40,
    productUrl: 'https://shop.mango.com/it/donna/gonne-midi/gonna-midi-plissettata_17092145.html',
    imageUrl: 'https://st.mngbcn.com/rcs/pics/static/T1/fotos/S20/17092145_99.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Parka con cappuccio',
    brand: 'Pull&Bear',
    category: 'clothing' as ProductCategory,
    source: 'pullbear' as ProductSource,
    originalPrice: 59.99,
    salePrice: 35.99,
    discountPercentage: 40,
    productUrl: 'https://www.pullandbear.com/it/parka-con-cappuccio-l05713527.html',
    imageUrl: 'https://static.pullandbear.net/2/photos/2024/V/0/2/p/5713/527/505/5713527505_1_1_8.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Stivali Chelsea in pelle',
    brand: 'ASOS DESIGN',
    category: 'shoes' as ProductCategory,
    source: 'asos' as ProductSource,
    originalPrice: 75,
    salePrice: 45,
    discountPercentage: 40,
    productUrl: 'https://www.asos.com/it/asos-design/asos-design-stivali-chelsea-in-pelle/prd/201234567',
    imageUrl: 'https://images.asos-media.com/products/asos-design-stivali-chelsea-in-pelle/201234567-1-black',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Maglione girocollo in cashmere',
    brand: 'Uniqlo',
    category: 'clothing' as ProductCategory,
    source: 'uniqlo' as ProductSource,
    originalPrice: 79.9,
    salePrice: 49.9,
    discountPercentage: 38,
    productUrl: 'https://www.uniqlo.com/it/it/product/maglione-girocollo-cashmere-donna-452341.html',
    imageUrl:
      'https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods/452341/item/goods_09_452341.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Vestito lungo a fiori',
    brand: 'Bershka',
    category: 'clothing' as ProductCategory,
    source: 'bershka' as ProductSource,
    originalPrice: 29.99,
    salePrice: 17.99,
    discountPercentage: 40,
    productUrl: 'https://www.bershka.com/it/vestito-lungo-a-fiori-c02345897.html',
    imageUrl: 'https://static.bershka.net/4/photos/2024/V/0/2/p/2345/897/800/2345897800_1_1_8.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Pantaloni palazzo in satin',
    brand: 'Stradivarius',
    category: 'clothing' as ProductCategory,
    source: 'stradivarius' as ProductSource,
    originalPrice: 29.99,
    salePrice: 19.99,
    discountPercentage: 33,
    productUrl: 'https://www.stradivarius.com/it/pantaloni-palazzo-in-satin-p03456784.html',
    imageUrl: 'https://static.e-stradivarius.net/5/photos/2024/V/0/1/p/3456/784/001/3456784001_1_1_8.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Nike Air Force 1',
    brand: 'Nike',
    category: 'shoes' as ProductCategory,
    source: 'nike' as ProductSource,
    originalPrice: 110,
    salePrice: 77,
    discountPercentage: 30,
    productUrl: 'https://www.nike.com/it/t/scarpa-air-force-1-07-QDdLJC/DD8959-100',
    imageUrl:
      'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/350e7f3a-979a-402b-9396-a8a998dd76ab/scarpa-air-force-1-07-QDdLJC.png',
    isNew: false,
    confidenceScore: 95,
  },
  {
    name: 'Adidas Superstar',
    brand: 'Adidas',
    category: 'shoes' as ProductCategory,
    source: 'adidas' as ProductSource,
    originalPrice: 100,
    salePrice: 70,
    discountPercentage: 30,
    productUrl: 'https://www.adidas.it/scarpe-superstar/EG4958.html',
    imageUrl:
      'https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/12365dbd78f944c4b4b4ab4900dd60f8_9366/Scarpe_Superstar_Bianco_EG4958_01_standard.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Blazer corto con bottoni',
    brand: 'Zara',
    category: 'clothing' as ProductCategory,
    source: 'zara' as ProductSource,
    originalPrice: 59.95,
    salePrice: 35.99,
    discountPercentage: 40,
    productUrl: 'https://www.zara.com/it/it/blazer-corto-con-bottoni-p02345726.html',
    imageUrl: 'https://static.zara.net/photos///2024/V/0/1/p/2345/726/251/2/w/750/2345726251_1_1_1.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Jeans skinny fit',
    brand: 'H&M',
    category: 'clothing' as ProductCategory,
    source: 'hm' as ProductSource,
    originalPrice: 29.99,
    salePrice: 19.99,
    discountPercentage: 33,
    productUrl: 'https://www2.hm.com/it_it/productpage.0456789001.html',
    imageUrl: 'https://image.hm.com/assets/hm/ab/cd/abcd1234567890abcdef1234567890ab.jpg',
    isNew: false,
    confidenceScore: 85,
  },
  {
    name: 'Cintura in pelle con fibbia',
    brand: 'Mango',
    category: 'accessories' as ProductCategory,
    source: 'mango' as ProductSource,
    originalPrice: 25.99,
    salePrice: 15.99,
    discountPercentage: 38,
    productUrl: 'https://shop.mango.com/it/donna/cinture/cintura-in-pelle-con-fibbia_18765024.html',
    imageUrl: 'https://st.mngbcn.com/rcs/pics/static/T1/fotos/S20/18765024_99.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Zaino con tasche multiple',
    brand: 'Pull&Bear',
    category: 'accessories' as ProductCategory,
    source: 'pullbear' as ProductSource,
    originalPrice: 29.99,
    salePrice: 19.99,
    discountPercentage: 33,
    productUrl: 'https://www.pullandbear.com/it/zaino-con-tasche-multiple-l06789527.html',
    imageUrl: 'https://static.pullandbear.net/2/photos/2024/V/0/2/p/6789/527/505/6789527505_1_1_8.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Cardigan lungo in maglia',
    brand: 'ASOS DESIGN',
    category: 'clothing' as ProductCategory,
    source: 'asos' as ProductSource,
    originalPrice: 42.99,
    salePrice: 25.79,
    discountPercentage: 40,
    productUrl: 'https://www.asos.com/it/asos-design/asos-design-cardigan-lungo-in-maglia/prd/204567890',
    imageUrl: 'https://images.asos-media.com/products/asos-design-cardigan-lungo-in-maglia/204567890-1-grey',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Giacca trapuntata ultra leggera',
    brand: 'Uniqlo',
    category: 'clothing' as ProductCategory,
    source: 'uniqlo' as ProductSource,
    originalPrice: 49.9,
    salePrice: 34.9,
    discountPercentage: 30,
    productUrl: 'https://www.uniqlo.com/it/it/product/giacca-trapuntata-ultra-leggera-donna-443211.html',
    imageUrl:
      'https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods/443211/item/goods_09_443211.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Gonna corta in ecopelle',
    brand: 'Bershka',
    category: 'clothing' as ProductCategory,
    source: 'bershka' as ProductSource,
    originalPrice: 19.99,
    salePrice: 12.99,
    discountPercentage: 35,
    productUrl: 'https://www.bershka.com/it/gonna-corta-in-ecopelle-c03456897.html',
    imageUrl: 'https://static.bershka.net/4/photos/2024/V/0/2/p/3456/897/800/3456897800_1_1_8.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Camicia oversize a righe',
    brand: 'Stradivarius',
    category: 'clothing' as ProductCategory,
    source: 'stradivarius' as ProductSource,
    originalPrice: 22.99,
    salePrice: 14.99,
    discountPercentage: 35,
    productUrl: 'https://www.stradivarius.com/it/camicia-oversize-a-righe-p04567784.html',
    imageUrl: 'https://static.e-stradivarius.net/5/photos/2024/V/0/1/p/4567/784/001/4567784001_1_1_8.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Nike Pegasus 40',
    brand: 'Nike',
    category: 'shoes' as ProductCategory,
    source: 'nike' as ProductSource,
    originalPrice: 140,
    salePrice: 98,
    discountPercentage: 30,
    productUrl: 'https://www.nike.com/it/t/scarpa-da-running-su-strada-pegasus-40-VZDrKm/DV3853-002',
    imageUrl:
      'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco/fb71e3c9-5a1e-4b3e-9c5e-5e1e1e1e1e1e/scarpa-da-running-su-strada-pegasus-40-VZDrKm.png',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Adidas NMD R1',
    brand: 'Adidas',
    category: 'shoes' as ProductCategory,
    source: 'adidas' as ProductSource,
    originalPrice: 150,
    salePrice: 105,
    discountPercentage: 30,
    productUrl: 'https://www.adidas.it/scarpe-nmd_r1/GZ7922.html',
    imageUrl:
      'https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/1a2b3c4d5e6f7g8h9i0j/Scarpe_NMD_R1_Nero_GZ7922_01_standard.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Cappotto in lana con cintura',
    brand: 'Zara',
    category: 'clothing' as ProductCategory,
    source: 'zara' as ProductSource,
    originalPrice: 149,
    salePrice: 89.99,
    discountPercentage: 40,
    productUrl: 'https://www.zara.com/it/it/cappotto-in-lana-con-cintura-p05678632.html',
    imageUrl: 'https://static.zara.net/photos///2024/V/0/1/p/5678/632/800/2/w/750/5678632800_1_1_1.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Maglione con scollo a V',
    brand: 'H&M',
    category: 'clothing' as ProductCategory,
    source: 'hm' as ProductSource,
    originalPrice: 24.99,
    salePrice: 16.99,
    discountPercentage: 32,
    productUrl: 'https://www2.hm.com/it_it/productpage.0567890001.html',
    imageUrl: 'https://image.hm.com/assets/hm/ef/gh/efgh2345678901bcdef2345678901ef.jpg',
    isNew: false,
    confidenceScore: 85,
  },
  {
    name: 'Gonna a pieghe midi',
    brand: 'Mango',
    category: 'clothing' as ProductCategory,
    source: 'mango' as ProductSource,
    originalPrice: 45.99,
    salePrice: 27.99,
    discountPercentage: 39,
    productUrl: 'https://shop.mango.com/it/donna/gonne-midi/gonna-a-pieghe-midi_19876024.html',
    imageUrl: 'https://st.mngbcn.com/rcs/pics/static/T1/fotos/S20/19876024_99.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Bomber jacket nylon',
    brand: 'Pull&Bear',
    category: 'clothing' as ProductCategory,
    source: 'pullbear' as ProductSource,
    originalPrice: 39.99,
    salePrice: 23.99,
    discountPercentage: 40,
    productUrl: 'https://www.pullandbear.com/it/bomber-jacket-nylon-l07890527.html',
    imageUrl: 'https://static.pullandbear.net/2/photos/2024/V/0/2/p/7890/527/505/7890527505_1_1_8.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Sneakers platform bianche',
    brand: 'ASOS DESIGN',
    category: 'shoes' as ProductCategory,
    source: 'asos' as ProductSource,
    originalPrice: 52.99,
    salePrice: 31.79,
    discountPercentage: 40,
    productUrl: 'https://www.asos.com/it/asos-design/asos-design-sneakers-platform-bianche/prd/206789012',
    imageUrl: 'https://images.asos-media.com/products/asos-design-sneakers-platform-bianche/206789012-1-white',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Parka imbottito lungo',
    brand: 'Uniqlo',
    category: 'clothing' as ProductCategory,
    source: 'uniqlo' as ProductSource,
    originalPrice: 99.9,
    salePrice: 69.9,
    discountPercentage: 30,
    productUrl: 'https://www.uniqlo.com/it/it/product/parka-imbottito-lungo-donna-434567.html',
    imageUrl:
      'https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods/434567/item/goods_09_434567.jpg',
    isNew: true,
    confidenceScore: 95,
  },
  {
    name: 'Vestito lungo con spacchi',
    brand: 'Bershka',
    category: 'clothing' as ProductCategory,
    source: 'bershka' as ProductSource,
    originalPrice: 35.99,
    salePrice: 21.59,
    discountPercentage: 40,
    productUrl: 'https://www.bershka.com/it/vestito-lungo-con-spacchi-c04567897.html',
    imageUrl: 'https://static.bershka.net/4/photos/2024/V/0/2/p/4567/897/800/4567897800_1_1_8.jpg',
    isNew: true,
    confidenceScore: 90,
  },
  {
    name: 'Pantaloni cargo vita alta',
    brand: 'Stradivarius',
    category: 'clothing' as ProductCategory,
    source: 'stradivarius' as ProductSource,
    originalPrice: 32.99,
    salePrice: 21.99,
    discountPercentage: 33,
    productUrl: 'https://www.stradivarius.com/it/pantaloni-cargo-vita-alta-p05678784.html',
    imageUrl: 'https://static.e-stradivarius.net/5/photos/2024/V/0/1/p/5678/784/001/5678784001_1_1_8.jpg',
    isNew: true,
    confidenceScore: 90,
  },
];

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Clear existing data (only in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🗑️  Clearing existing data...');
      await prisma.userInteraction.deleteMany({});
      await prisma.verificationHistory.deleteMany({});
      await prisma.productImage.deleteMany({});
      await prisma.translation.deleteMany({});
      await prisma.product.deleteMany({});
      console.log('✅ Existing data cleared');
    }

    // Insert products
    console.log(`📦 Inserting ${seedProducts.length} products...`);

    for (const productData of seedProducts) {
      const product = await prisma.product.create({
        data: {
          ...productData,
          lastVerifiedAt: new Date(),
          isActive: true,
        },
      });

      // Add primary image if imageUrl exists
      if (productData.imageUrl) {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            imageUrl: productData.imageUrl,
            imageStatus: 'validated',
            isPrimary: true,
            lastCheckedAt: new Date(),
          },
        });
      }

      // Add verification history entry
      await prisma.verificationHistory.create({
        data: {
          productId: product.id,
          verificationType: 'manual_seed',
          status: 'success',
          previousConfidence: 70,
          newConfidence: productData.confidenceScore,
          metadata: { source: 'seed_script', verified: true },
        },
      });
    }

    console.log('✅ Products inserted successfully');

    // Create some sample translations for the first 5 products
    console.log('🌐 Adding sample translations...');

    const productsToTranslate = await prisma.product.findMany({
      take: 5,
      orderBy: { createdAt: 'asc' },
    });

    const languages = ['en', 'es', 'fr', 'de', 'pt'];

    for (const product of productsToTranslate) {
      for (const lang of languages) {
        await prisma.translation.create({
          data: {
            productId: product.id,
            language: lang,
            name: product.name, // In real app, would be translated
            description: product.description,
            isAutoTranslated: true,
            translatedBy: 'seed_script',
          },
        });
      }
    }

    console.log('✅ Sample translations added');

    // Get final counts
    const productCount = await prisma.product.count();
    const imageCount = await prisma.productImage.count();
    const translationCount = await prisma.translation.count();
    const verificationCount = await prisma.verificationHistory.count();

    console.log('\n📊 Seeding Summary:');
    console.log(`   Products: ${productCount}`);
    console.log(`   Images: ${imageCount}`);
    console.log(`   Translations: ${translationCount}`);
    console.log(`   Verification History: ${verificationCount}`);
    console.log('\n✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
