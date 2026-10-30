import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Карточка каталога рендерится максимум ~400px CSS, герой — во всю ширину колонки.
    // Ширины 2048/3840 не нужны ни одному изображению витрины: убираем лишние
    // варианты, чтобы srcset не предлагал браузеру гигантские файлы.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [128, 256, 384],
    formats: ["image/webp"],
    // Исходники уже пережаты в WebP 800px — кэшируем надолго.
    minimumCacheTTL: 31536000,
  },
};

export default nextConfig;
