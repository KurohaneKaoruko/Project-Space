import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,
  async redirects() {
    return [
      // simulations / visualizations -> algorithms（蚁群已迁移至算法分类）
      { source: '/simulations/Mandelbrot', destination: '/visualizations/Mandelbrot', permanent: true },
      { source: '/simulations/DigitSumTurtle', destination: '/visualizations/DigitSumTurtle', permanent: true },
      { source: '/simulations/TSPAntColony', destination: '/algorithms/TSPAntColony', permanent: true },
      { source: '/visualizations/TSPAntColony', destination: '/algorithms/TSPAntColony', permanent: true },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      config.optimization.minimizer.forEach((plugin: any) => {
        if (plugin.constructor.name === 'TerserPlugin') {
          plugin.options.terserOptions = {
            ...plugin.options.terserOptions,
            mangle: {
              keep_classnames: false,
              keep_fnames: false,
            },
            compress: {
              drop_console: true, // 移除所有 console.log
              passes: 2, // 增加压缩次数
            },
          };
        }
      });
    }
    return config;
  },
};

export default nextConfig;
