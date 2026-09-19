# 第三方声明

`@hanamesh/lib-provision` 0.1.0-rc.1 **没有运行时依赖**。tar / zip 读取、CRC32、sha256、HTTP 下载全部基于 Node.js 内置模块（`zlib`、`crypto`、`fs`、`fetch`）。

开发依赖（不随包分发）：

| 包 | 版本 | 许可证 | 用途 |
|---|---|---|---|
| typescript | 5.9.3 | Apache-2.0 | 构建 `lib/` 与 `.d.ts` |
| @types/node | 22.19.7 | MIT | 类型声明 |
| undici-types | 6.21.0 | MIT | `@types/node` 的锁定传递依赖 |

测试 fixture 里的自签证书（`tests/fixtures/fixture-cert.pem` / `fixture-key.pem`）由本仓生成，仅供本地 HTTPS fixture 使用，不随包分发。
