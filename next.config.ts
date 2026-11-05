import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 纯静态导出：全站 50 页 SSG，无 SSR/ISR/Server Action，
  // 部署到 Cloudflare Pages（输出 out/，构建命令 pnpm build）
  output: "export",
  // sourcemap 体积大且生成耗时；生产环境默认关闭，需要排查时再开
  productionBrowserSourceMaps: false,
  // 旧路径重定向改用 public/_redirects（Pages 原生支持；output: export 不支持 redirects()）
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
