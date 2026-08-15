# 峡谷英雄典藏馆

一个面向中文玩家的非官方英雄卡鉴赏网站。项目使用 Riot Data Dragon 的公开静态数据，提供英雄与皮肤浏览、3D 卡片鉴赏、多卡对比和卡面导出。

> 公开发布前需先在 Riot Developer Portal 完成产品登记。

## 功能

- 173 位英雄、2,097 款非炫彩皮肤的中文数据快照
- 单机/局域网「峡谷身份战」：身份场、1v1、2v2，173 英雄（定位技能模板），空位 AI，可选音效
- 单机「峡谷格斗」：街霸向四键 1v1（打电脑或本地双人），8 名英雄立绘木偶对战，不支持联机
- 高清原画智能取景，使用官方竖版构图定位主角并在低置信度时安全回退
- 卡内原画、景深与金属框分层，拖动时呈现人物视差、轮廓受光与高光变化
- 3D 拖动旋转、惯性、翻面、缩放、全屏专注和 1600×1000 PNG 导出
- 中文名、称号、英文 ID 检索与六类英雄筛选
- 最多 6 张卡面对比、拖拽排序和键盘替代操作
- 通过 URL 分享当前英雄、皮肤和对比顺序
- WebGL、减少动态效果与移动端兼容降级

## 本地开发

```bash
npm install
npm run data:sync
npm run dev
```

局域网联机（同一 Wi-Fi，一人开房）：

```bash
npm run dev:lan
```

终端会打印 `ws://<局域网IP>:8788`。房主在对局里点「开房」，其他人输入该地址加入。

常用命令：

```bash
npm run typecheck
npm test
npm run build
npm run data:sync -- --version 16.13.1
```

## 发布

CI 会在 `main` 和 Pull Request 上执行类型检查、测试与生产构建。GitHub Pages 工作流只有在仓库变量 `RIOT_PRODUCT_REGISTERED` 设置为 `true` 时才会部署；请先在 Riot Developer Portal 完成产品登记，再启用该变量并手动触发首次部署。

## 数据与权属

英雄、皮肤、技能与原画数据来自 [Riot Data Dragon](https://developer.riotgames.com/docs/lol)。本仓库不会提交 Riot 的大体积原画副本，运行时从官方 CDN 加载素材。

“峡谷英雄典藏馆”是免费、无广告的非官方粉丝项目，不代表 Riot Games 的观点，也未获得 Riot Games 的认可或赞助。峡谷身份战同样是粉丝作品，规则受经典身份卡牌启发，未获得任何卡牌厂商授权。联机仅限同一局域网 WebSocket，无公网匹配。峡谷格斗是粉丝作品，规则受经典 2D 格斗启发，未获得任何格斗游戏厂商授权，且不支持联机。

The Rift Archive isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
