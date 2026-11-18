# 单词默写（vocab-drill）

粘贴「英文 + 中文」单词表，练习时**只显示中文**，学生填写英文。答完自动收集错词，并在本机保存历史记录。

纯静态页面，无需安装、无需联网、无需构建。

## 使用

双击打开 `index.html`（推荐 Chrome / Edge），粘贴单词表后点「开始默写」。

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
- `Enter` 确认 / `下一个`，`Esc` 跳过
- 一轮结束后显示正确、错误、跳过与正确率
- 错词和跳过词汇总，可「再练错词」
- 历史记录保存在浏览器 `localStorage`（最多 50 次），可展开查看每轮错词
- 可选的随机顺序；粘贴内容会自动存草稿，刷新不丢

## 文件

| 文件 | 说明 |
| --- | --- |
| `index.html` | 界面与交互 |
| `parser.js` | 单词表解析、答案归一化与判定 |
| `quiz.js` | 出题顺序、答题状态与统计 |
| `*.test.js` | Node 内置测试 |

## 测试

```bash
node --test "vocab-drill/*.test.js"
```

## 数据说明

答题记录只存在当前浏览器的 `localStorage` 中（键：`vocabDrill.history.v1`、`vocabDrill.draft.v1`），不会上传到任何服务器。
