# 单词默写（vocab-drill）

内置鲁教版五四制初中英语单词总表（六上—九全，48 个单元、2168 个词条），也可以粘贴自己的词表。练习时**只显示中文**，学生填写英文；答对自动进入下一题，答完自动收集错词并保存历史记录。

纯静态页面，无需安装、无需构建；本地双击即可离线使用。

线上地址：<https://qiyuting0827.github.io/vocab-drill/>（应用入口）；Netlify 仅提供同步中转：<https://vocab-drill-sync.netlify.app/>

## 使用

双击打开 `index.html`（推荐 Chrome / Edge），然后：

1. 在「学员」下拉框选择学员；第一次使用点「管理名单」添加姓名，或批量导入（每行一个，也可用逗号、顿号分隔）；
2. 在「内置词库」里勾选要练的单元（可整册全选），勾选后可在「调整范围」里选择从第几个词到第几个词，只练其中一段；需要时填「本次抽取 N 个词」随机抽一部分；
3. 或者切到「粘贴词表」，粘贴自己的单词表；
4. 点「开始默写」。

内置词库按册分组：六上、六下、七上、七下、八上、九全。勾选状态和单词范围会记住，下次打开还在。

### 粘贴格式

每行一个单词，英文和中文谁在前都可以，支持这些分隔方式：

```
apple 苹果
apple,苹果
apple，苹果
apple	苹果
apple - 苹果
1. apple 苹果
apple n. 苹果
苹果 apple
look after / take care of 照顾
take off 起飞；脱下
```

无法识别的行（例如只有中文或只有英文）会提示行号并自动跳过。

## 功能

- 看中文默写英文，大小写、多余空格、全角字母、弯引号都不影响判定
- 按答案的字母数显示逐字格，填完一格自动跳到下一格；多词之间的空格自动留位，撇号、连字符直接显示，不用输入
- 练习页使用按题生成的小键盘：只出现答案用到的字母和几个随机干扰字母，不会弹出系统输入法；电脑上也可直接用实体键盘输入
- 若同一词有多个长度不同的可接受答案，自动改用整词输入框（仍使用内置键盘）
- 一个词组有多种写法时（如 `a lot of / lots of`），输入其中任意一种都算对
- 学员名单可添加、批量导入；开始前直接选择学员，姓名会显示在练习页、结果页并写入历史
- 每位学员有独立错题本：答错/跳过的词自动收录，错几次、对几次、上次练习时间都有记录
- 错题本可按学员查看、单个移除或清空；点「复习错题」直接生成该学员的错词练习
- 复习时同一个词连续答对两次会自动移出错题本；设置页会提示该学员还有多少错词待复习
- 历史记录可按学员筛选
- 可选云同步：同一个同步码，在多台手机/平板/电脑之间同步名单、历史和错题本
- 答对后约 0.75 秒自动进入下一题；答错/跳过会停留，方便看正确答案
- `Enter` 确认 / 下一个，`Esc` 跳过
- 可打乱顺序；内置词库可整册、按单元、按单元内单词起止范围选词，也可随机抽取 N 个词
- 一轮结束后显示正确、错误、跳过与正确率
- 错词和跳过词汇总，可「再练错词」
- 历史记录保存在浏览器 `localStorage`（最多 50 次），可展开查看每轮错词
- 粘贴内容会自动存草稿，刷新不丢

## 云同步（可选）

不开启时，所有数据只在本机浏览器里，换设备需要重新导入名单。

开启后，名单、历史记录、错题本会自动上传；在新设备打开页面，输入同一个同步码即可拉取。

1. 点页面顶部「云同步」→「生成新的同步码」；
2. 复制同步码保存好（它相当于密码）；
3. 另一台设备打开同一页面 →「云同步」→ 粘贴同步码 →「连接」；
4. 之后每次打开会先从云端读取；名单、历史或错题发生变化后约 1 秒自动上传。

实现方式：前端只请求 Netlify Function `/.netlify/functions/sync`，由它转发到 Supabase；数据库表只允许通过两个带同步码的 RPC 读写，不能匿名遍历。同步码为 25 位随机字符，知道同步码的人都能查看和修改对应数据，请勿公开。

部署中转：把本仓库接入 Netlify（`netlify.toml` 已配置好构建命令 `exit 0`、发布目录 `netlify/relay`、函数目录 `netlify/functions`），站点名使用 `vocab-drill-sync`；数据库结构见 `supabase/schema.sql`。Netlify 根路径只显示“同步服务运行中”的占位页，不部署练习应用；同步接口为 `/.netlify/functions/sync`。

## 数据备份与恢复

开启云同步后，云端本身就有一份持续备份：每个同步码对应一份完整快照，本机变化约 1 秒后自动覆盖更新。

本机另存一份（浏览器控制台执行）：

```js
copy(JSON.stringify({
  students: JSON.parse(localStorage.getItem('vocabDrill.students.v1') || '[]'),
  history: JSON.parse(localStorage.getItem('vocabDrill.history.v1') || '[]'),
  mistakes: JSON.parse(localStorage.getItem('vocabDrill.mistakes.v1') || '{}')
}, null, 2));
```

恢复时先把「云同步」退出，再执行下面代码并粘贴备份 JSON，最后刷新页面：

```js
const d = JSON.parse(prompt('粘贴备份 JSON') || '{}');
localStorage.setItem('vocabDrill.students.v1', JSON.stringify(d.students || []));
localStorage.setItem('vocabDrill.history.v1', JSON.stringify(d.history || []));
localStorage.setItem('vocabDrill.mistakes.v1', JSON.stringify(d.mistakes || {}));
location.reload();
```

如果先恢复再退出同步，页面打开时会先从云端拉取并覆盖本机数据。恢复确认后再重新生成或连接同步码上传。

## 文件

| 文件 | 说明 |
| --- | --- |
| `index.html` | 界面与交互 |
| `words.js` | 内置词库（由教材词汇表生成） |
| `scripts/build-words.py` | 从教材 xlsx 重新生成 `words.js` |
| `bank-select.js` | 单元单词范围与选词收集 |
| `parser.js` | 单词表解析、答案归一化与判定 |
| `quiz.js` | 出题顺序、答题状态与统计 |
| `students.js` | 学员名单与错题本的数据处理 |
| `sync.js` | 云同步客户端：同步码、负载合并、拉取与上传 |
| `supabase/schema.sql` | Supabase 表结构与 RPC |
| `netlify/functions/sync.js` | Netlify 同步中转 |
| `netlify.toml` | Netlify 构建与函数目录配置 |
| `*.test.js` | Node 内置测试 |

## 测试

```bash
node --test "vocab-drill/*.test.js"
```

## 数据说明

答题记录、单元勾选与单词范围、粘贴草稿、学员名单与错题本默认只存在当前浏览器的 `localStorage` 中（键：`vocabDrill.history.v1`、`vocabDrill.bank.v1`、`vocabDrill.draft.v1`、`vocabDrill.students.v1`、`vocabDrill.mistakes.v1`、`vocabDrill.selectedStudent.v1`、`vocabDrill.sync.v1`）。

开启云同步后，学员名单、历史记录和错题本会通过 Cloudflare Pages 中转保存到 Supabase；单元选择、草稿和当前选中的学员仍只在本机。同步码保存在 `vocabDrill.sync.v1`，退出同步会删除本机的同步码和版本号，但不会删除本机数据或云端数据。
