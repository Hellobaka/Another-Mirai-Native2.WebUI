# API 文档

## 约定

- **Base URL:** `http://{host}:{port}/api`
- **Content-Type:** `application/json`
- **认证:** 除 `/auth/login` 外所有接口需携带 `Authorization: Bearer {token}` 头
- **响应格式:** 统一包装

```jsonc
// 成功
{
  "code": 0,
  "data": { /* 具体数据 */ }
}

// 失败
{
  "code": -1,          // 或具体错误码
  "message": "错误描述"
}
```

- **分页参数 (Query String):**
  - `page`: 页码，从 1 开始，默认 1
  - `pageSize`: 每页条数，默认 20，最大 100

- **分页响应:**

```jsonc
{
  "code": 0,
  "data": {
    "items": [
      /* ... */
    ],
    "total": 150,
    "page": 1,
    "pageSize": 20,
  },
}
```

---

## 1. 认证

### 1.1 登录

```
POST /api/auth/login
```

**Request:**

```jsonc
{
  "password": "string",
}
```

**Response (成功):**

```jsonc
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOi...",
    "expiresAt": "2026-05-22T00:00:00Z",
  },
}
```

**Response (失败):**

```jsonc
{
  "code": 401,
  "message": "密码错误",
}
```

### 1.2 刷新 Token

```
GET /api/auth/refresh
```

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOi...",
    "expiresAt": "2026-05-22T00:00:00Z",
  },
}
```

**Response (失败):**

```jsonc
{
  "code": 401,
  "message": "未登录或登录失效",
}
```

---

## 2. 仪表盘

### 2.1 系统概览

```
GET /api/dashboard/base-information
```

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "osVersion": "Microsoft Windows 11 家庭版 中文版 64 位 版本 25H2",
    "cpu": "AMD Ryzen 5 PRO 4650U with Radeon Graphics @ 2.10 GHz",
    "totalMemory": 15229,
    "startedTime": "00:00:00:14",
    "version": "2.12.1.0",
    "currentBotQQ": 10001,
    "currentBotNick": "",
    "loadedPluginCount": 0,
    "dotNetRuntimeVersion": ".NET 9.0.12",
    "workingDirectory": "D:\\Code\\Another-Mirai-Native2",
    "diskFreeSpaceInGB": 1024.11,
    "diskTotalSpaceInGB": 2048.22,
  },
  "message": null,
}
```

### 2.2 系统占用

```
GET /api/dashboard/usages
```

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "cpuUsage": 20.830696,
    "memoryUsage": 85.56701030927834,
    "usedMemoryInMB": 13031,
    "totalMemoryInMB": 15229,
  },
  "message": null,
}
```

### 2.3 插件占用

```
GET /api/dashboard/plugin-usages
```

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "totalProcessMemory": 42.65625,
    "totalProcessCPU": 0.5207086756763764,
    "processedMessageCount": 111,
    "sentMessageCount": 22,
    "pluginUsages": [
      {
        "id": 0,
        "pid": 27068,
        "pluginName": "主框架",
        "running": true,
        "cpuUsage": 0.5207086756763764,
        "memoryUsage": 42.65625,
      },
    ],
  },
  "message": null,
}
```

> Id = 0 代表框架本身

---

## 3. 插件管理

### 3.1 插件列表

```
GET /api/plugin
```

**Response:**

```jsonc
{
  "code": 0,
  "data": [
    {
      "authCode": 10001,
      "enabled": false,
      "pluginId": "启用插件以查看 AppId",
      "pluginName": "水银掷筛机",
      "author": "落花茗",
      "description": "R!",
      "version": "1.1.3",
      "auth": [101, 106],
    },
    {
      "authCode": 10002,
      "enabled": false,
      "pluginId": "启用插件以查看 AppId",
      "pluginName": "Steam视奸机",
      "author": "落花茗",
      "description": "玩啥呢 不叫我",
      "version": "1.0.0",
      "auth": [101, 106, 161],
    },
    {
      "authCode": 10003,
      "enabled": true,
      "pluginId": "me.cqp.luohuaming.AdvancedDice",
      "pluginName": "水银掷骰机2",
      "author": "落花茗",
      "description": "R!!",
      "version": "2.0.0",
      "auth": [
        20, 30, 101, 103, 106, 110, 120, 121, 122, 123, 124, 125, 126, 127, 128, 130, 131, 132, 140,
        150, 151, 160, 161, 162, 180,
      ],
    },
  ],
  "message": null,
}
```

### 3.2 拉取插件元数据

```
POST /api/plugin/{authCode}/info
```

#### PluginType 枚举

| 枚举 | 值         |
| ---- | ---------- |
| 0    | 酷Q插件    |
| 1    | 小栗子插件 |
| 2    | 原生插件   |

#### Auth 枚举

| 枚举 | 值               |
| ---- | ---------------- |
| 20   | 取Cookies        |
| 30   | 接收语音         |
| 101  | 发送群消息       |
| 103  | 发送讨论组消息   |
| 106  | 发送私聊消息     |
| 110  | 发送赞           |
| 120  | 置群员移除       |
| 121  | 置群员禁言       |
| 122  | 置群管理员       |
| 123  | 置全群禁言       |
| 124  | 置匿名群员禁言   |
| 125  | 置群匿名设置     |
| 126  | 置群成员名片     |
| 127  | 置群退出         |
| 128  | 置群成员专属头衔 |
| 130  | 取群成员信息     |
| 131  | 取陌生人信息     |
| 132  | 取群信息         |
| 140  | 置讨论组退出     |
| 150  | 置好友添加请求   |
| 151  | 置群添加请求     |
| 160  | 取群成员列表     |
| 161  | 取群列表         |
| 162  | 取好友列表       |
| 180  | 撤回消息         |

#### 200

**Response:**

```json
{
  "code": 0,
  "data": {
    "authCode": 10001,
    "enabled": true,
    "pluginId": "me.cqp.luohuaming.Dice",
    "pluginName": "水银掷筛机",
    "version": "1.1.3",
    "author": "落花茗",
    "description": "R!",
    "auth": [101, 106],
    "pluginType": 0
  },
  "message": null
}
```

### 400

```json
{
  "code": 404,
  "data": null,
  "message": "未找到对应 AuthCode 的插件"
}
```

### 3.2 启用插件

```
POST /api/plugin/{authCode}/enable
```

#### 200

**Response:**

```json
{
  "code": 0,
  "data": {
    "authCode": 10001,
    "enabled": true,
    "pluginId": "me.cqp.luohuaming.Dice",
    "pluginName": "水银掷筛机",
    "author": "落花茗",
    "description": "R!",
    "version": "1.1.3",
    "auth": [101, 106]
  },
  "message": null
}
```

### 400

```json
{
  "code": 404,
  "data": null,
  "message": "未找到对应 AuthCode 的插件"
}
```

### 3.3 禁用插件

```
POST /api/plugin/{authCode}/disable
```

#### 200

**Response:**

```json
{
  "code": 0,
  "data": {
    "authCode": 10001,
    "enabled": false,
    "pluginId": "启用插件以查看 AppId",
    "pluginName": "水银掷筛机",
    "author": "落花茗",
    "description": "R!",
    "version": "1.1.3",
    "auth": [101, 106]
  },
  "message": null
}
```

### 400

```json
{
  "code": 404,
  "data": null,
  "message": "未找到对应 AuthCode 的插件"
}
```

### 3.4 重载单个

```
POST /api/plugin/{authCode}/reload
```

#### 200

**Response:**

```json
{
  "code": 0,
  "data": {
    "authCode": 10005,
    "enabled": true,
    "pluginId": "me.cqp.luohuaming.AdvancedDice",
    "pluginName": "水银掷骰机2",
    "author": "落花茗",
    "description": "R!!",
    "version": "2.0.0",
    "auth": [
      20, 30, 101, 103, 106, 110, 120, 121, 122, 123, 124, 125, 126, 127, 128, 130, 131, 132, 140,
      150, 151, 160, 161, 162, 180
    ]
  },
  "message": null
}
```

### 400

```json
{
  "code": 404,
  "data": null,
  "message": "未找到对应 AuthCode 的插件"
}
```

### 3.5 重载全部

```
POST /api/plugin/reload-all
```

#### 200

```json
{
  "code": 0,
  "data": [
    {
      "authCode": 10004,
      "enabled": false,
      "pluginId": "启用插件以查看 AppId",
      "pluginName": "水银掷筛机",
      "author": "落花茗",
      "description": "R!",
      "version": "1.1.3",
      "auth": [101, 106]
    },
    {
      "authCode": 10005,
      "enabled": false,
      "pluginId": "启用插件以查看 AppId",
      "pluginName": "Steam视奸机",
      "author": "落花茗",
      "description": "玩啥呢 不叫我",
      "version": "1.0.0",
      "auth": [101, 106, 161]
    },
    {
      "authCode": 10006,
      "enabled": true,
      "pluginId": "me.cqp.luohuaming.AdvancedDice",
      "pluginName": "水银掷骰机2",
      "author": "落花茗",
      "description": "R!!",
      "version": "2.0.0",
      "auth": [
        20, 30, 101, 103, 106, 110, 120, 121, 122, 123, 124, 125, 126, 127, 128, 130, 131, 132, 140,
        150, 151, 160, 161, 162, 180
      ]
    }
  ],
  "message": null
}
```

### 3.6 添加插件

```
POST /api/plugin/add
Content-Type: multipart/form-data
```

**参数:**

| 参数   | 类型     | 说明                         |
| ------ | -------- | ---------------------------- |
| `dll`  | file     | 插件 DLL 文件（必填）        |
| `json` | file     | 插件 JSON 清单文件（必填）   |

**约束:**
- DLL 扩展名必须为 `.dll`
- JSON 文件名需与 DLL 同名（`plugin.dll` + `plugin.json`）
- 请求体限制 50MB
- 插件会移至 `data/plugins/` 目录并加载元数据

**Response 成功:**

```json
{
  "code": 0,
  "data": {
    "authCode": 10007,
    "enabled": false,
    "pluginId": "me.cqp.example.Plugin",
    "pluginName": "示例插件",
    "author": "作者",
    "description": "描述",
    "version": "1.0.0",
    "auth": [101, 106]
  }
}
```

**Response 失败:**

| 状态码 | message                              | 说明                         |
| ------ | ------------------------------------ | ---------------------------- |
| 400    | 请选择要上传的插件 DLL 文件          | dll 为空                     |
| 400    | 仅支持 DLL 格式的插件文件            | 扩展名不是 .dll              |
| 400    | 请选择要上传的插件 JSON 清单文件     | json 为空                    |
| 400    | 添加插件失败，检查 DLL 与 JSON 是否有效 | AddPlugin 返回 false         |
| 500    | 由于服务器内部错误，添加插件失败     | 文件写入或加载异常           |

### 3.7 调用插件菜单

```
POST /api/plugin/{authCode}/menu?menuName={name}
```

**参数:**

| 参数       | 类型   | 说明                 |
| ---------- | ------ | -------------------- |
| `authCode` | int    | 插件授权码（路径参数） |
| `menuName` | string | 菜单名称（必填）     |

触发指定插件的菜单事件，返回事件处理结果。

**Response 成功:**

```json
{
  "code": 0,
  "data": null
}
```

**Response 失败:**

| 状态码 | message                        | 说明                         |
| ------ | ------------------------------ | ---------------------------- |
| 404    | 未找到对应 AuthCode 的插件     | 插件不存在                   |
| 400    | 菜单名称不能为空               | menuName 为空                |

---

## 4. 协议管理

### 4.1 可用协议列表

```
GET /api/protocol/list
```

**Response:**

```jsonc
{
  "code": 0,
  "data": ["MiraiAPIHttp", "Lagrange.Core", "NoConnection", "OneBot v11", "Satori v1"],
  "message": null,
}
```

### 4.2 当前协议名称以及连接状态

```
GET /api/protocol/current
```

#### 200

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "name": "NoConnection",
    "isConnected": true,
  },
  "message": null,
}
```

#### 404

```json
{
  "code": 404,
  "message": "当前没有已连接协议，无法执行断开"
}
```

### 4.3 断开当前协议

```
Get /api/protocol/disconnect
```

#### 200

**Request:**

```jsonc
{
  "code": 0,
  "data": null,
  "message": null,
}
```

#### 400

```json
{
  "code": 400,
  "message": "当前没有已连接协议，无法执行断开"
}
```

```json
{
  "code": 500,
  "message": "断开连接失败"
}
```

```json
{
  "code": 500,
  "message": "由于服务器发生异常，断开连接失败"
}
```

### 4.5 连接到新协议

```
Get /api/protocol/connect/{name}
```

#### 200

**Response:**

```json
{
  "code": 0,
  "data": null,
  "message": null
}
```

#### 400

```json
{
  "code": 400,
  "message": "当前已连接到 {p.Name} 协议，连接到其他协议前请先断开"
}
```

```json
{
  "code": 400,
  "message": "连接到 {name} 协议失败"
}
```

```json
{
  "code": 500,
  "message": "由于服务器发生异常，连接到 {name} 协议失败"
}
```

### 4.6 获取协议配置字典

```
Get /api/protocol/config/{name}
```

#### 200

```json
{
  "code": 0,
  "data": {
    "Ws": "",
    "AuthKey": ""
  },
  "message": null
}
```

#### 404

```json
{
  "code": 404,
  "message": "未找到名称为 {name} 的协议"
}
```

#### 400

```json
{
  "code": 400,
  "message": "由于服务器发生异常，获取协议配置参数失败"
}
```

### 4.7 设置协议配置字典

```
Post /api/protocol/config/{name}
```

Body:

```json
{
  "Ws": "ws://127.0.0.1:11451",
  "AuthKey": "1919810"
}
```

#### 200

```json
{
  "code": 0,
  "data": null,
  "message": null
}
```

#### 404

```json
{
  "code": 404,
  "message": "未找到名称为 {name} 的协议"
}
```

#### 400

```json
{
  "code": 400,
  "message": "由于服务器发生异常，获取协议配置参数失败"
}
```

```json
{
  "code": 400,
  "message": "设置协议连接参数失败，检查传递参数是否缺失键或无效值"
}
```

---

## 5. 聊天

| ChatHistoryType | 值  | 说明 |
| --------------- | --- | ---- |
| Group           | 0   | 群聊 |
| Private         | 1   | 私聊 |
| Notice          | 2   | 通知 |

### 5.1 会话列表

```
GET /api/chat/categories
```

获取所有聊天会话分类（按最后一条消息降序）。`message` 字段为已解析的消息链，`time` 已转为 DateTime。

**Response (200):**

```jsonc
{
  "code": 0,
  "data": [
    {
      "parentID": 123456789,
      "senderID": 987654321,
      "type": 0,
      "time": "2026-05-21T12:00:00",
      "message": [
        {
          /* MessageItemBase[] — 消息链，见附录 */
        },
      ],
      "unreadCount": 3,
      "isPinned": false,
    },
  ],
}
```

| 字段          | 类型              | 说明                         |
| ------------- | ----------------- | ---------------------------- |
| `parentID`    | long              | 群号或 QQ 号                 |
| `senderID`    | long              | 最后发言者 QQ                |
| `type`        | int               | 0=Group, 1=Private, 2=Notice |
| `time`        | DateTime          | 最后消息时间                 |
| `message`     | MessageItemBase[] | 已解析的消息链               |
| `unreadCount` | int               | 未读消息数                   |
| `isPinned`    | bool              | 是否置顶                     |

**Response (404):** `{ "code": 404, "message": "聊天功能未启用" }`

---

### 5.2 查询聊天记录

```
GET /api/chat/history?chatHistoryType={0|1}&parentId={id}&pageIndex=1&pageSize=50
```

| 参数              | 类型 | 说明               |
| ----------------- | ---- | ------------------ |
| `chatHistoryType` | int  | 0=Group, 1=Private |
| `parentId`        | long | 群号或 QQ 号       |
| `pageIndex`       | int  | 页码，从 1 开始    |
| `pageSize`        | int  | 每页条数，默认 50  |

**Response (200):**

```jsonc
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "time": "2026-05-21T12:00:00",
      "type": 0,
      "parentID": 123456789,
      "senderID": 987654321,
      "message": [
        {
          /* MessageItemBase[] — 消息链，见附录 */
        },
      ],
      "msgId": 5001,
      "recalled": false,
      "pluginName": "",
    },
  ],
}
```

| 字段         | 类型              | 说明               |
| ------------ | ----------------- | ------------------ |
| `id`         | int               | 记录 ID            |
| `time`       | DateTime          | 消息时间           |
| `type`       | int               | 0=Group, 1=Private |
| `parentID`   | long              | 群号或 QQ 号       |
| `senderID`   | long              | 发送者 QQ          |
| `message`    | MessageItemBase[] | 已解析的消息链     |
| `msgId`      | int               | 协议层消息 ID      |
| `recalled`   | bool              | 是否已撤回         |
| `pluginName` | string            | 处理该消息的插件名 |

> 返回为 `ChatHistoryDto[]`，前端需按 `pageIndex`/`pageSize` 自行判断是否有更多页（返回条数 < pageSize 即为最后一页）。

**Response (404):** `{ "code": 404, "message": "聊天功能未启用" }`

---

### 5.3 查询单条消息

```
GET /api/chat/message?chatHistoryType={0|1}&parentId={id}&messageId={msgId}
```

| 参数              | 类型 | 说明               |
| ----------------- | ---- | ------------------ |
| `chatHistoryType` | int  | 0=Group, 1=Private |
| `parentId`        | long | 群号或 QQ 号       |
| `messageId`       | int  | 消息 ID            |

**Response (200):** 同 5.2 中的单条 `ChatHistoryDto` 格式

**Response (404):**

```jsonc
{ "code": 404, "message": "未找到对应的聊天消息" }
```

---

### 5.4 发送消息

```
POST /api/chat/send
```

**Request:**

```jsonc
{
  "chatType": 1,
  "parentId": 123456789,
  "message": "你好世界",
}
```

| 字段       | 类型   | 说明                   |
| ---------- | ------ | ---------------------- |
| `chatType` | int    | 0=Group, 1=Private     |
| `parentId` | long   | 群号或 QQ 号           |
| `message`  | string | 消息文本（可含 CQ 码） |

**Response (200):**

```jsonc
{
  "code": 0,
  "data": { "msgId": 5002 },
}
```

**Response (400):**

```jsonc
{ "code": 400, "message": "发送目标无效" }
{ "code": 400, "message": "发送消息不得为空" }
{ "code": 400, "message": "发送目标类型无效" }
{ "code": 400, "message": "消息发送失败" }
```

---

### 5.5 好友昵称

```
GET /api/chat/friend-nick?qq={qq}
```

**Response (200):**

```jsonc
{
  "code": 0,
  "data": { "nick": "好友昵称" },
}
```

---

### 5.6 群名称

```
GET /api/chat/group-name?groupId={groupId}
```

**Response (200):**

```jsonc
{
  "code": 0,
  "data": { "groupName": "群名称" },
}
```

---

### 5.7 群成员名片

```
GET /api/chat/group-member-card?groupId={groupId}&qq={qq}
```

**Response (200):**

```jsonc
{
  "code": 0,
  "data": { "card": "群名片" },
}
```

---

### 5.8 清除未读

```
POST /api/chat/clear-unread?chatHistoryType={0|1}&parentId={id}
```

**Response:** `{ "code": 0, "data": null }`

### 5.9 撤回消息

```
POST /api/chat/recall?chatHistoryType={0|1}&parentId={id}&messageId={id}
```

**参数:**

| 参数              | 类型            | 说明                     |
| ----------------- | --------------- | ------------------------ |
| `chatHistoryType` | ChatHistoryType | 聊天类型：0=群聊，1=私聊 |
| `parentId`        | long            | 群号或好友 QQ            |
| `messageId`       | int             | 消息 ID                  |

**Response 成功:** `{ "code": 0, "data": null }`

**Response 失败:**

| 状态码 | message              | 说明                     |
| ------ | -------------------- | ------------------------ |
| 404    | 聊天功能未启用       | EnableChat 为 false      |
| 404    | 未找到对应的聊天消息 | messageId 对应消息不存在 |
| 400    | 撤回消息失败         | 协议层撤回失败（如超时） |

### 5.10 获取收藏图片列表

```
GET /api/chat/collected
```

获取所有已收藏图片的文件名列表。

**Response:**

```json
{
  "code": 0,
  "data": ["abc123.png", "def456.jpg"]
}
```

### 5.11 收藏图片

```
POST /api/chat/collect?file={hash}
```

**参数:**

| 参数   | 类型   | 说明                 |
| ------ | ------ | -------------------- |
| `file` | string | 图片缓存哈希（必填） |

将已缓存的图片复制到收藏目录（`data/image/collected/`）。

**Response 成功:** `{ "code": 0, "data": "abc123.png" }` — data 为收藏后的文件名

**Response 失败:**

| 状态码 | message                          | 说明                |
| ------ | -------------------------------- | ------------------- |
| 404    | 聊天功能未启用                   | EnableChat 为 false |
| 404    | 找不到此哈希对应的缓存文件       | 图片未缓存或已删除  |
| 500    | 由于服务器内部错误，收藏图片失败 | 文件复制异常        |

### 5.12 CQ 码转消息链

```
GET /api/chat/message-chain?message={cq_code}
```

**参数:**

| 参数      | 类型   | 说明                     |
| --------- | ------ | ------------------------ |
| `message` | string | 原始 CQ 码字符串（必填） |

将前端输入的原始 CQ 码字符串解析为结构化的 `MessageItemBase[]`，方便消息发送前预览。

**Response:**

```json
{
  "code": 0,
  "data": {
    "message": [
      { "messageItemType": 13, "content": "你好" },
      { "messageItemType": 1, "faceId": 12 }
    ]
  }
}
```

> `message` 数组格式参见 [附录：消息链格式](#附录消息链格式)。

### 5.13 上传图片

```
POST /api/chat/upload-picture
Content-Type: multipart/form-data
```

**参数:**

| 参数   | 类型      | 说明                        |
| ------ | --------- | --------------------------- |
| `file` | IFormFile | 图片文件（必填，form-data） |

上传图片到 `data/image/` 目录，返回可直接放入消息链的 `Image` 片段。

**约束:**

- 仅允许 `PNG`、`JPG`、`JPEG`、`GIF` 格式
- 生成 GUID 文件名存储在 `data/image/`，返回 `filePath` 指向 `cached\{GUID}.ext`

**Response 成功:**

```json
{
  "code": 0,
  "data": {
    "item": {
      "messageItemType": 3,
      "hash": "",
      "filePath": "cached\\a1b2c3d4.png",
      "isFlash": false,
      "isEmoji": false
    }
  }
}
```

**Response 失败:**

| 状态码 | message                                     | 说明                |
| ------ | ------------------------------------------- | ------------------- |
| 404    | 聊天功能未启用                              | EnableChat 为 false |
| 400    | 请选择要上传的图片文件                      | file 为空           |
| 400    | 仅支持 PNG、JPG、JPEG 和 GIF 格式的图片文件 | 扩展名不合法        |
| 500    | 由于服务器内部错误，上传图片失败            | 文件写入异常        |

---

## 6. 日志

### 6.1 查询日志

```
GET /api/log
```

**参数:**

| 参数        | 类型     | 说明                   |
| ----------- | -------- | ---------------------- |
| `priority`  | int      | 最小日志等级           |
| `pageIndex` | int      | 页码数                 |
| `pageSize`  | int      | 每页条数               |
| `search`    | string   | 来源，模糊匹配（可选） |
| `asc`       | bool     | 按时间升序（可选）     |
| `start`     | datetime | 开始时间（可选）       |
| `end`       | datetime | 结束时间（可选）       |

**Response:**

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 267,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载插件",
        "detail": "配置中启动启用插件为 1 个，开始加载..."
      },
      {
        "id": 268,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载插件",
        "detail": "水银掷筛机 插件信息读取成功"
      },
      {
        "id": 269,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载插件",
        "detail": "Steam视奸机 插件信息读取成功"
      },
      {
        "id": 270,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载插件",
        "detail": "将使用主程序加载"
      },
      {
        "id": 271,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载插件",
        "detail": "水银掷骰机2 插件信息读取成功"
      },
      {
        "id": 272,
        "time": "2026-05-23T14:16:32+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "√ 91 ms",
        "name": "加载插件",
        "detail": "加载完成，启用插件..."
      },
      {
        "id": 273,
        "time": "2026-05-23T14:16:34+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "√ 1361 ms",
        "name": "启用插件",
        "detail": "插件启用完成，共加载了 1 个插件，开始调用启动事件..."
      },
      {
        "id": 274,
        "time": "2026-05-23T14:16:34+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "",
        "name": "加载 C# 插件",
        "detail": "水银掷骰机2, 加载成功"
      },
      {
        "id": 275,
        "time": "2026-05-23T14:16:34+08:00",
        "priority": 10,
        "source": "水银掷骰机2",
        "status": "",
        "name": "水银掷骰机2",
        "detail": "插件已启用"
      },
      {
        "id": 276,
        "time": "2026-05-23T14:16:34+08:00",
        "priority": 11,
        "source": "AMN框架",
        "status": "√ 39 ms",
        "name": "启用插件",
        "detail": "插件启动完成，开始处理消息逻辑"
      }
    ],
    "totalCount": 276,
    "totalPage": 28
  },
  "message": null
}
```

---

## 7. 配置

### 7.1 获取核心配置

```
GET /api/config/core
```

**Response:**

```jsonc
{
  "code": 0,
  "data": {
    "AutoConnect": {
      "title": "协议自动连接",
      "description": "",
      "type": "Boolean",
      "value": true,
    },
    "AutoProtocol": {
      "title": "自动连接协议",
      "description": "选择启动时自动连接的协议",
      "type": "String",
      "value": "NoConnection",
    },
    "ReconnectTime": {
      "title": "重新连接间隔时间",
      "description": "协议失去连接时每次重新连接的间隔时间",
      "type": "Int32",
      "value": 5000,
    },
    "PluginExitWhenCoreExit": {
      "title": "框架退出时插件自动退出",
      "description": "主程序退出时自动关闭所有插件",
      "type": "Boolean",
      "value": true,
    },
    "RestartPluginIfDead": {
      "title": "插件崩溃时自动重启",
      "description": "插件发生异常时自动重新启动",
      "type": "Boolean",
      "value": false,
    },
    "HeartBeatInterval": {
      "title": "心跳间隔时间",
      "description": "核心与插件之间的心跳检测间隔",
      "type": "Int32",
      "value": 30000,
    },
    "PluginInvokeTimeout": {
      "title": "插件方法调用超时",
      "description": "",
      "type": "Int32",
      "value": 120000,
    },
    "LoadTimeout": {
      "title": "插件载入超时",
      "description": "",
      "type": "Int32",
      "value": 10000,
    },
    "UseDatabase": {
      "title": "日志使用数据库",
      "description": "是否将日志存储到数据库",
      "type": "Boolean",
      "value": true,
    },
    "MessageCacheSize": {
      "title": "消息缓存数量",
      "description": "内存中缓存的消息数量限制",
      "type": "Int32",
      "value": 4096,
    },
    "EnableChatImageCacheMaxSizeControl": {
      "title": "启用最大缓存图片体积控制",
      "description": "缓存文件夹超出体积时，会从最久的图片开始删除",
      "type": "Boolean",
      "value": false,
    },
    "MaxChatImageCacheFolderSize": {
      "title": "缓存文件夹最大大小",
      "description": "",
      "type": "Int64",
      "value": 1024,
    },
    "EnableChatImageCacheExpireTimeControl": {
      "title": "启用缓存图片最大储存时限控制",
      "description": "图片最大保留一定天数后，会从最久的图片开始删除",
      "type": "Boolean",
      "value": false,
    },
    "ChatImageCacheExpireTime": {
      "title": "缓存图片最大储存时限",
      "description": "",
      "type": "Int64",
      "value": 30,
    },
    "DebugMode": {
      "title": "调试模式",
      "description": "启用调试模式输出详细信息",
      "type": "Boolean",
      "value": false,
    },
    "ActionAfterOfflineSeconds": {
      "title": "离线操作等待时间",
      "description": "离线后执行操作的等待时间",
      "type": "Int32",
      "value": 120,
    },
    "OfflineActionSendEmail": {
      "title": "启用离线后邮件发送",
      "description": "",
      "type": "Boolean",
      "value": false,
    },
    "OfflineActionEmail_SMTPServer": {
      "title": "SMTP服务器",
      "description": "",
      "type": "String",
      "value": "smtp.qq.com",
    },
    "OfflineActionEmail_SMTPPort": {
      "title": "SMTP服务器端口",
      "description": "",
      "type": "UInt16",
      "value": 587,
    },
    "OfflineActionEmail_SMTPUsername": {
      "title": "SMTP用户名",
      "description": "",
      "type": "String",
      "value": "",
    },
    "OfflineActionEmail_SMTPPassport": {
      "title": "SMTP授权码",
      "description": "",
      "type": "String",
      "value": "",
    },
    "OfflineActionEmail_SMTPSenderEmail": {
      "title": "邮件发送方邮箱",
      "description": "",
      "type": "String",
      "value": "",
    },
    "OfflineActionEmail_SMTPReceiveEmail": {
      "title": "邮件接收方邮箱",
      "description": "",
      "type": "String",
      "value": "",
    },
    "OfflineActionRunCommand": {
      "title": "启用离线后执行终端指令",
      "description": "",
      "type": "Boolean",
      "value": false,
    },
    "OfflineActionCommands": {
      "title": "离线后执行终端指令",
      "description": "",
      "type": "List`1",
      "value": [],
    },
  },
  "message": null,
}
```

### 7.2 更新配置项

```
Post /api/config/core
```

**Request:**

```jsonc
{
  "key": "MessageCacheSize",
  "value": 1024,
}
```

#### 200

**Response:** `{ "code": 0, "data": null }`

#### 404

```json
{
  "code": 404,
  "data": null,
  "message": "未能找到名称为 MessageCacheSize1 的配置项"
}
```

#### 400

```json
{
  "code": 400,
  "data": null,
  "message": "无效的数值转换，检查写入值是否与配置类型匹配"
}
```

### 7.3 获取协议配置项

```
Get /api/config/protocol/{name}
```

#### 200

```json
{
  "code": 0,
  "data": {
    "WebSocketURL": {
      "title": "正向 WebSocket 服务器 Url",
      "description": "",
      "type": "String",
      "value": "1"
    },
    "AuthKey": {
      "title": "鉴权 Token",
      "description": "",
      "type": "String",
      "value": "null"
    },
    "QQ": {
      "title": "目标 QQ",
      "description": "",
      "type": "Int64",
      "value": 3
    },
    "FullMemberInfo": {
      "title": "详细群成员信息",
      "description": "调用更详细的群成员信息接口 但是可能大幅度加长调用时长",
      "type": "Boolean",
      "value": false
    }
  },
  "message": null
}
```

#### 404

```json
{
  "code": 404,
  "data": null,
  "message": "未能找到名称为 MiraiAPIHttp1 的协议配置"
}
```

### 7.4 更新配置项

```
Post /api/config/protocol/{name}
```

**Request:**

```jsonc
{
  "key": "FullMemberInfo",
  "value": false,
}
```

#### 200

**Response:** `{ "code": 0, "data": null }`

#### 404

```json
{
  "code": 404,
  "data": null,
  "message": "未能找到名称为 MessageCacheSize1 的配置项"
}
```

#### 400

```json
{
  "code": 400,
  "data": null,
  "message": "无效的数值转换，检查写入值是否与配置类型匹配"
}
```

---

### 7.4 获取 WebUI 配置

```
GET /api/config/webui
```

获取 WebUI 自身的配置项（监听地址、端口、HTTPS、证书路径等），每项含标题、描述和当前值。

**Response:**

```json
{
  "code": 0,
  "data": {
    "ListenIP": {
      "title": "监听 IP",
      "description": "WebUI 服务监听的 IP 地址，* 表示监听所有地址",
      "type": "String",
      "value": "127.0.0.1"
    },
    "ListenPort": {
      "title": "监听端口",
      "description": "WebUI 服务监听的端口号",
      "type": "Int32",
      "value": 5000
    },
    "EnableHTTPS": {
      "title": "启用 HTTPS",
      "description": "是否启用 HTTPS 加密连接",
      "type": "Boolean",
      "value": false
    },
    "CertificatePath": {
      "title": "HTTPS 证书路径",
      "description": "HTTPS 证书文件（PEM 或 PFX）的存放路径",
      "type": "String",
      "value": ""
    },
    "CertificateKeyPath": {
      "title": "证书密钥路径",
      "description": "HTTPS 证书密钥文件的存放路径",
      "type": "String",
      "value": ""
    },
    "EnableChat": {
      "title": "",
      "description": "",
      "type": "Boolean",
      "value": true
    },
    "EnableFileManager": {
      "title": "",
      "description": "",
      "type": "Boolean",
      "value": false
    },
    "EnableTerminal": {
      "title": "",
      "description": "",
      "type": "Boolean",
      "value": false
    }
  },
  "message": null
}
```

### 7.5 修改 WebUI 配置

```
POST /api/config/webui
```

修改 WebUI 监听地址、端口、HTTPS 证书路径及管理密码。修改后需重启 WebUI 生效。

**Request:**

| 参数    | 类型   | 说明                                                                                       |
| ------- | ------ | ------------------------------------------------------------------------------------------ |
| `Key`   | string | 配置项名：ListenIP、ListenPort、EnableHTTPS、Password、CertificatePath、CertificateKeyPath |
| `Value` | any    | 新值，类型自动适配                                                                         |

```json
{
  "key": "ListenPort",
  "value": 8080
}
```

**Response (200):**

```json
{
  "code": 0,
  "data": null,
  "message": null
}
```

**Response (400):**

```json
{
  "code": 400,
  "data": null,
  "message": "端口号需在 0 ~ 65535 之间"
}
```

**Response (404):**

```json
{
  "code": 404,
  "data": null,
  "message": "未能找到名称为 xxx 的 WebUI 配置项"
}
```

---

## 8. 图片

### 8.1 获取缓存文件

```
GET /api/cache/{type}/{file}
```

- `type`是指文件的类型，目前有三种可选`image`（图片）、`record`（音频）、`video`（视频）
- `file`是指文件名，有两种选项：1. 缓存哈希 2. 文件名

**Response:** 301重定向至文件的原生url

---

# SignalR Hub

## 连接

```
GET /realtime?access_token={token}
```

通过 Query String 传递 JWT。

## 事件 (服务端 → 客户端)

### OnGroupMsg — 群消息

```jsonc
{
  "msgId": 5001,
  "group": 123456789,
  "qq": 987654321,
  "msg": [
    {
      /* MessageItemBase */
    },
  ],
  "time": "2026-05-21T12:00:00",
}
```

### OnPrivateMsg — 私聊消息

```jsonc
{
  "msgId": 5002,
  "qq": 987654321,
  "msg": [
    {
      /* MessageItemBase */
    },
  ],
  "time": "2026-05-21T12:00:00",
}
```

> `msg` 字段为已解析的消息链（`MessageItemBase[]`），前端无需自行解析 CQ 码。消息链格式见 [附录：消息链格式](#附录消息链格式)。

### OnGroupAdded — 群成员增加

```jsonc
{
  "group": 123456789,
  "qq": 987654321,
}
```

### OnGroupLeft — 群成员退出

```jsonc
{
  "group": 123456789,
  "qq": 987654321,
}
```

### OnGroupBan — 群禁言

```jsonc
{
  "group": 123456789,
  "qq": 987654321,
  "operatedQQ": 111111,
  "time": 100,
}
```

### OnGroupMsgRecall — 群消息撤回

```jsonc
{
  "msgId": 5001,
  "qq": 987654321,
  "msg": "消息内容",
}
```

### OnPrivateMsgRecall — 私聊消息撤回

```jsonc
{
  "msgId": 5002,
  "qq": 987654321,
  "msg": "消息内容",
}
```

### OnGroupMessageSend — 群消息发送回执

```jsonc
{
  "msgId": 5003,
  "group": 123456789,
  "msg": "消息内容",
  "plugin": {
    /* PluginDto */
  },
}
```

### OnPrivateMessageSend — 私聊消息发送回执

```jsonc
{
  "msgId": 5004,
  "qq": 987654321,
  "msg": "消息内容",
  "plugin": {
    /* PluginDto */
  },
}
```

### PluginEnableChanged — 插件启用/禁用

```jsonc
{
  "plugin": {
    /* PluginDto */
  },
}
```

### PluginAdded — 新插件加载

```jsonc
{
  "plugin": {
    /* PluginDto */
  },
}
```

### PluginRemoved — 插件卸载

```jsonc
{
  "plugin": {
    /* PluginDto */
  },
}
```

### PluginConnectStatusChanged — 插件连接状态变更

```jsonc
{
  "plugin": {
    /* PluginDto */
  },
}
```

### ProtocolOnline — 协议上线

```jsonc
{
  "name": "OneBot v11",
}
```

### ProtocolOffline — 协议下线

```jsonc
{
  "name": "OneBot v11",
}
```

### CurrentBotInfoChanged — Bot 信息变更

```jsonc
{
  "nick": "机器人昵称",
  "qq": 123456789,
}
```

### LogAdded — 新日志

```jsonc
{
  "logId": 1,
  "log": {
    /* LogDto */
  },
}
```

### LogStatusUpdated — 日志状态更新

```jsonc
{
  "logId": 1,
  "status": "read",
}
```

### UsageUpdated — 系统资源占用更新（每秒）

```jsonc
{
  "cpuUsage": 23.5,
  "memoryUsage": 45.2,
  "cpuCurrentFrequency": 3600.0,
  "usedMemoryInMB": 8192,
  "totalMemoryInMB": 16384,
}
```

### PluginUsageUpdated — 进程资源占用更新（每秒）

```jsonc
{
  "totalProcessMemory": 512.5,
  "totalProcessCPU": 12.3,
  "processedMessageCount": 1000,
  "sentMessageCount": 500,
  "pluginUsages": [
    {
      /* DashboardPluginItem */
    },
  ],
}
```

---

# 附录：消息链格式

SignalR 的 `OnGroupMsg` 和 `OnPrivateMsg` 事件中，`msg` 字段为服务端解析后的消息链数组，每个元素继承自 `MessageItemBase`，通过 `messageItemType` 字段区分类型（值为数字）。

## MessageItemType 枚举

| 值  | 对应类型 | 说明                   |
| --- | -------- | ---------------------- |
| 0   | Unknown  | 未知                   |
| 1   | Face     | QQ 表情                |
| 2   | Bface    | 大表情                 |
| 3   | Image    | 图片                   |
| 4   | Record   | 语音                   |
| 5   | Video    | 视频                   |
| 6   | At       | @提及                  |
| 7   | Rps      | 猜拳魔法表情           |
| 8   | Shake    | 窗口抖动               |
| 9   | Dice     | 掷骰子                 |
| 10  | Poke     | 戳一戳                 |
| 11  | Rich     | 富媒体（XML/JSON/App） |
| 12  | Reply    | 引用回复               |
| 13  | Text     | 纯文本                 |
| 14  | File     | 文件                   |

## 公共字段

```jsonc
{
  "messageItemType": 13, // 所有消息片段共有，值为上表中的数字
}
```

## 各类型具体字段

### Unknown (0) - 无法解析的消息

```jsonc
{
  "messageItemType": 0,
  "raw": "无法解析的消息原文",
}
```

### Text (13) — 纯文本

```jsonc
{
  "messageItemType": 13,
  "content": "你好",
}
```

### Face (1) — QQ 表情

```jsonc
{
  "messageItemType": 1,
  "faceId": 12,
}
```

| 字段     | 说明                           |
| -------- | ------------------------------ |
| `faceId` | QQ 表情 ID（对应 CQFace 枚举） |

### BFace (2) — 大表情

```jsonc
{
  "messageItemType": 2,
  "faceId": 1,
}
```

| 字段     | 说明        |
| -------- | ----------- |
| `faceId` | 原创表情 ID |

### Image (3) — 图片

```jsonc
{
  "messageItemType": 3,
  "hash": "abcdef123456",
  "filePath": null,
  "isFlash": false,
  "isEmoji": false,
}
```

| 字段       | 说明                                            |
| ---------- | ----------------------------------------------- |
| `hash`     | 缓存哈希（通过 `/api/cache/image/{hash}` 获取） |
| `filePath` | 本地路径（非 null 时优先使用）                  |
| `isFlash`  | 是否为闪照                                      |
| `isEmoji`  | 是否为表情贴纸                                  |

### Record (4) — 语音

```jsonc
{
  "messageItemType": 4,
  "hash": "abcdef123456",
  "filePath": null,
}
```

### At (6) — @提及

```jsonc
{
  "messageItemType": 6,
  "target": 987654321,
  "allTarget": false,
}
```

| 字段        | 说明                               |
| ----------- | ---------------------------------- |
| `target`    | 目标 QQ 号                         |
| `allTarget` | 是否 @全体成员（此时 target 为 0） |

### Reply (12) — 引用回复

```jsonc
{
  "messageItemType": 12,
  "id": 5001,
}
```

### Dice (9) — 骰子

```jsonc
{
  "messageItemType": 9,
  "point": 1,
}
```

| 字段    | 说明            |
| ------- | --------------- |
| `point` | 骰子点数（1-6） |

### RPS (7) — 猜拳

```jsonc
{
  "messageItemType": 7,
  "rpsType": 1,
}
```

| 字段      | 说明                           |
| --------- | ------------------------------ |
| `rpsType` | 猜拳类型：1=石头，2=剪刀，3=布 |

### Shake (8) — 窗口抖动

```jsonc
{
  "messageItemType": 8,
}
```

### Poke (10) — 戳一戳

```jsonc
{
  "messageItemType": 10,
  "action": "戳一戳",
}
```

| 字段     | 说明           |
| -------- | -------------- |
| `action` | 戳一戳动作名称 |

### RichContent (11) — 富媒体

```jsonc
{
  "messageItemType": 11,
  "richContentType": "Json",
  "content": "{\"app\":\"com.tencent...\"}",
}
```

| 字段              | 说明                         |
| ----------------- | ---------------------------- |
| `richContentType` | 类型：`Json` / `Xml` / `App` |
| `content`         | 卡片内容字符串               |

### File (14) - 文件

```jsonc
{
  "messageItemType": 14,
  "fileName": "20260524.zip",
  "fileSize": 2291085,
}
```

| 字段       | 说明             |
| ---------- | ---------------- |
| `fileName` | 文件名称         |
| `fileSize` | 文件大小（字节） |
