# SmartQuote Pro 前后端协作说明

**适用对象：** Frontend / Backend / Integration 开发成员  
**版本：** 2026-08-27  
**当前阶段：** Basic Database Skeleton 已完成并通过本地验证

---

## 1. 文档目的

这份文档用于说明 SmartQuote Pro 当前前端、后端和 PostgreSQL 数据库之间的职责边界、已实现内容、接口约定、启动方式，以及下一阶段前后端对接顺序。

当前目标不是一次性完成所有业务功能，而是先保证：

1. 现有 React + TypeScript 报价 UI 不被破坏；
2. 价目、颜色、配件和公司资料可以从 PostgreSQL 持久化读取；
3. 后端逐步接管客户、报价、报价号和 issued quote 快照；
4. 前端保留快速本地算价体验，但正式保存时以后端结果为准。

**Source of truth：** 当前字段和业务约定以 `docs/backend-handoff-zh.md` 和现有前端类型/实现为准。不要在前后端未同步的情况下擅自修改 JSON 字段名。

---

## 2. 当前整体架构

```text
React + TypeScript Frontend
        │
        │ HTTP / JSON
        ▼
Express + TypeScript Backend
        │
        │ Prisma
        ▼
PostgreSQL 16
```

本地开发默认：

```text
Frontend    http://localhost:5173
Backend     http://localhost:3001
PostgreSQL  localhost:5432
```

> Vite 如果自动选择其他端口，以终端实际输出为准。

---

## 3. 当前已经完成的内容

### 3.1 Database Skeleton

当前已经建立并验证以下核心表：

- `company_settings`
- `products`
- `product_categories`
- `price_cells`
- `mesh_extras`
- `colours`
- `colour_products`
- `addons`
- `staff_users`
- `customers`
- `quotes`
- `quote_lines`

另外建立：

- PostgreSQL sequence：`quote_number_seq`
- 初始值：`33021`
- 运行时格式化为 8 位报价号，例如 `00033021`

当前不做：`room_photos`、MYOB/Xero、在线支付、客户门户、自动发邮件，以及更复杂的 opening/measurement/revision 等未来结构。

### 3.2 已验证的 Seed 数据

本地 Prisma Studio 已确认：

| Model | Seed records |
|---|---:|
| Product | 4 |
| ProductCategory | 9 |
| PriceCell | 946 |
| MeshExtra | 16 |
| Addon | 23 |
| Colour | 31 |
| ColourProduct | 109 |
| CompanySettings | 1 |
| Customer | 0 |
| Quote | 0 |
| QuoteLine | 0 |
| StaffUser | 0 |

`Customer`、`Quote`、`QuoteLine`、`StaffUser` 当前为 0 是正常的：seed 不应灌入真实客户和业务报价，鉴权也尚未实现。

### 3.3 当前已跑通

- Docker Compose PostgreSQL 16
- Prisma schema validation / generate
- committed migration
- migration apply 到真实本地 PostgreSQL
- seed 执行成功
- Express backend 启动成功
- catalogue/company API smoke tests 成功
- frontend tests / production build 无回归

---

## 4. Repository 结构与职责

### Frontend

现有重点目录：

```text
src/data/                  bundled pricing/addon/colour data
src/types/pricing.ts       pricing types
src/lib/priceLookup.ts     本地矩阵查价
src/lib/pricingContext.tsx 当前 active price list
src/lib/xlsxImport.ts      浏览器 xlsx 导入
src/lib/quoteContext.tsx   当前 quote state / localStorage
src/pages/                 Home / Calculator / AddOns / QuoteSummary
```

`src/data/*.json` 仍然保留，当前阶段不要删除。它们既是前端 fallback，也是 seed/对照数据来源。

### Backend

当前 backend 放在同一 repository 的：

```text
server/
```

主要结构：

```text
server/src/                 Express application / routes
server/prisma/schema.prisma Prisma schema
server/prisma/migrations/   committed migrations
server/prisma/seed.ts       seed script
server/.env                 local only; MUST NOT commit
```

### Database / local infrastructure

```text
docker-compose.yml          PostgreSQL local development service
```

---

## 5. 当前 API 状态

Base URL：

```text
/api/v1
```

当前本地 backend：

```text
http://localhost:3001
```

### 5.1 已实现并 smoke-tested

| Method | Path | 用途 |
|---|---|---|
| GET | `/health` | backend health check |
| GET | `/api/v1/products` | 产品、分类、价格矩阵和 mesh extras |
| GET | `/api/v1/addons` | 配件目录 |
| GET | `/api/v1/colours` | 颜色目录 / compatibility data |
| GET | `/api/v1/company` | 公司资料和报价参数 |

> 当前这些 catalogue endpoints 已经可以从 PostgreSQL 返回数据。

### 5.2 API contract 中下一步要实现

以下是目标接口，不代表当前已经全部实现：

```text
POST   /api/v1/pricing/lookup

GET    /api/v1/customers?q=
POST   /api/v1/customers
GET    /api/v1/customers/:id
PATCH  /api/v1/customers/:id

GET    /api/v1/quotes
POST   /api/v1/quotes
GET    /api/v1/quotes/:id
PATCH  /api/v1/quotes/:id
POST   /api/v1/quotes/:id/issue
POST   /api/v1/quotes/:id/void

POST   /api/v1/quotes/:id/lines
PATCH  /api/v1/quotes/:id/lines/:lineId
DELETE /api/v1/quotes/:id/lines/:lineId
```

鉴权、Admin catalogue write APIs、photo storage 后做。

---

## 6. Frontend 开发说明

### 6.1 当前原则

前端继续负责：

- onsite quotation UI
- measurement/configuration input
- responsive local price preview
- Quote Summary / review UI
- print/display formatting
- 用户输入校验和交互体验

前端**不要**把 PostgreSQL 或 Prisma 逻辑放进 React。

### 6.2 数据来源迁移计划

| 当前前端来源 | 接入 backend 后 |
|---|---|
| `src/data/pricing.json` | `GET /api/v1/products` |
| `src/data/addons.json` | `GET /api/v1/addons` |
| `src/data/colours.json` | `GET /api/v1/colours` |
| `src/data/company.ts` | `GET /api/v1/company` |
| localStorage quote list | quote/customer APIs |
| 浏览器本地报价号 | backend `quote_number_seq` |

建议不要一次性删除本地逻辑。先用 API adapter/service layer 替换 data source，让 UI component 尽量不需要大改。

### 6.3 Pricing 的职责边界

前端可以继续使用 `priceLookup.ts` 做即时 preview，避免现场输入时每个字段变化都等待网络请求。

但正式保存 quote line 时：

```text
Frontend preview price → 仅供 UI 展示
Backend recalculation  → authoritative price
Database unit_price    → saved snapshot
```

如果前后端算价不一致，保存后的 UI 应使用 backend response 更新。

### 6.4 Frontend 不应继续长期负责的内容

随着 API 完成，以下功能应逐步从 `localStorage` / 浏览器状态迁出：

- 已保存报价列表
- 正式 quote number
- customer records
- issued quote totals
- company settings persistence
- quote status lifecycle

---

## 7. Backend 开发说明

### 7.1 Backend 当前职责

Backend 应逐步成为以下内容的 authoritative source：

- PostgreSQL persistence
- customer records
- quote / quote line persistence
- quote number generation
- pricing validation
- quote totals
- issued quote snapshots
- company settings
- 后续 staff authentication / authorization

### 7.2 Quote number

使用数据库 sequence：

```sql
nextval('quote_number_seq')
```

再格式化：

```text
33021 → 00033021
```

`quote_suffix` 独立保存，例如：

```text
00033012-SS
00033012-IG
```

已使用/已发出的报价号永不复用。sequence 出现 gap 是允许的。

### 7.3 Quote snapshot

`quote_lines.unit_price` 必须保存成交/报价时的单价快照。

`quotes` 中以下金额也应保存 snapshot：

- `colour_surcharge`
- `sale_amount`
- `gst_amount`
- `total_amount`
- `deposit_amount`
- `paid`

原因：以后价格表更新不能改变已经 `issued` 的历史报价。

### 7.4 Quote lifecycle

目标状态：

```text
draft → issued → accepted
           └──→ void
```

当前重点先实现 `draft` / `issued`。

约束：

- draft：允许编辑 line / description / price / customer / colour 等
- issued：金额和明细锁定
- issued 后仍允许更新 `paid`
- 已出单不要物理删除；需要取消时使用 `void`

---

## 8. 前后端必须一致的 Business Rules

### 8.1 Dimension price lookup

输入 width / height 只向上匹配：

```text
matchedWidth  = 最小的 matrix width  >= input width
matchedHeight = 最小的 matrix height >= input height
```

例如已知测试用例：

```text
Supascreen sliding door
925 mm × 2100 mm
→ 应匹配 1050 mm × 2100 mm 档
```

规则：

- 小于最小档：使用最小档，并标记 `clampedToMin`
- 超过最大档：`TOO_LARGE`
- matrix cell 为 `null` / N/A：`UNAVAILABLE`

### 8.2 Money

数据库金额：

```text
NUMERIC(10,2)
```

金额公式：

```text
saleAmount
  = sum(line.unitPrice × quantity)
  + colourSurcharge

gstAmount
  = gstEnabled ? round(saleAmount × gstRate) : 0

totalAmount
  = saleAmount + gstAmount

depositAmount
  = round(totalAmount × depositRate)

balance
  = max(0, totalAmount - paid)
```

默认：

```text
GST                  10%
Deposit              50%
Non-standard colour  $220
```

具体数值应从 `company_settings` 读取，不要散落 hard-code。

### 8.3 Colour

- 标准颜色按 product compatibility 过滤
- `Non-standard / Other` 对所有产品可选
- 非标颜色默认增加公司设置中的 surcharge
- `custom_frame_colour` 保存员工填写的实际颜色名
- quote 可以通过 `colour_extra_override` 覆盖默认 surcharge

### 8.4 Addons

普通 addon 使用 flat price。

`price_on_request = true` 的 addon 必须由员工先输入价格，再允许加入 quote。

---

## 9. 本地运行整个系统

### Terminal 1 — PostgreSQL

项目根目录：

```bash
cd /mnt/d/SmartQuote-Pro
docker compose up -d
docker compose ps
```

### Terminal 2 — Backend

```bash
cd /mnt/d/SmartQuote-Pro/server
npm install
npm run dev
```

正常输出：

```text
[server] listening on http://localhost:3001
```

### Terminal 3 — Frontend

```bash
cd /mnt/d/SmartQuote-Pro
npm install
npm run dev
```

浏览器打开终端显示的 Vite URL，通常为：

```text
http://localhost:5173
```

### API smoke test

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/v1/products
curl http://localhost:3001/api/v1/addons
curl http://localhost:3001/api/v1/colours
curl http://localhost:3001/api/v1/company
```

---

## 10. 新环境第一次启动数据库

```bash
cd /mnt/d/SmartQuote-Pro
docker compose up -d

cd server
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

查看数据库：

```bash
npx prisma studio
```

开发者不要手工创建生产结构；schema 改动应通过 Prisma migration 进入 Git。

---

## 11. Git / Security 约定

必须提交：

- `docker-compose.yml`
- `server/src/**`
- `server/prisma/schema.prisma`
- `server/prisma/migrations/**`
- `server/prisma/seed.ts`
- `.env.example`

不能提交：

- `server/.env`
- `node_modules/`
- build output
- PostgreSQL data volume
- 密码 / token / real secrets
- 客户 quote PDF 或含真实个人信息的资料

数据库代码和 migration 应进入 Git；运行中的 PostgreSQL 数据文件不进入 Git。

---

## 12. GitHub Pages 说明

GitHub Pages 只能托管静态 frontend build，不能运行：

- Express backend
- PostgreSQL
- Docker Compose

因此：

```text
GitHub Pages success ≠ full-stack deployment success
```

Pages workflow 失败也不等于 database/backend implementation 失败。

完整生产部署未来需要分别考虑 frontend hosting、backend hosting 和 managed PostgreSQL。

---

## 13. 下一阶段推荐顺序

### Backend

1. `POST /pricing/lookup`
2. Customer CRUD
3. Quote CRUD
4. Quote lines CRUD
5. issue / void lifecycle
6. staff login/auth
7. phase 2 photos

### Frontend

1. 建立 `api/` 或 `services/` layer
2. catalogue 数据切换到 GET APIs
3. 保留本地 pricing preview
4. Customer form 接 Customer API
5. Quote save/load 接 Quote API
6. 删除正式 quote number 的 browser ownership
7. issued quote UI 按 backend status 锁定

### Integration

每接一块都做同一组验证：

```text
UI input
→ frontend preview
→ API request
→ backend validation/recalculation
→ PostgreSQL save
→ API response
→ UI refresh
```

不要等所有 API 都写完后再一次性集成。

---

## 14. 当前 Sprint 状态

**Basic Database Skeleton：DONE**

已具备：

- reproducible PostgreSQL environment
- Prisma schema + migration
- seeded catalogue/pricing data
- company/product/colour/addon persistence
- staff/customer/quote/quote-line core tables
- database-owned quote number sequence
- basic catalogue API reads
- local full-stack startup

下一阶段重点应是 **API persistence + frontend integration**，而不是继续扩大数据库 scope。
