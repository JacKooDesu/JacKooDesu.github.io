---
title: Rails MySQL JSON Index
date: 2026-02-10 21:04:11
tags: [MySQL, ROR]
excerpt: "本文介紹在 Rails 專案中，針對 MySQL JSON 欄位建立索引的方法，並說明查詢與效能優化的實務技巧。"
---

## 原始目標

假設結構長得像：

```Text
+-----------+--------------+------+-----+---------+----------------+
| Field     | Type         | Null | Key | Default | Extra          |
+-----------+--------------+------+-----+---------+----------------+
| id        | bigint       | NO   | PRI | NULL    | auto_increment |
| name      | varchar(255) | NO   |     | NULL    |                |
| linked_id | int          | NO   |     | NULL    |                |
+-----------+--------------+------+-----+---------+----------------+
```

如果常用 `linked_id` 篩選，基本上就會給他加個 Index。

Rails 端遷移長得像：

```Ruby
add_index(:targets, ["linked_id"], name: "linked_id_index")
```

## 需求改變後

`linked_id` 欄位變成了 `linked_ids`，是個 `JSON ARRAY`：

```Text
+-----------+--------------+------+-----+---------+----------------+
| Field     | Type         | Null | Key | Default | Extra          |
+-----------+--------------+------+-----+---------+----------------+
| id        | bigint       | NO   | PRI | NULL    | auto_increment |
| name      | varchar(255) | NO   |     | NULL    |                |
| linked_ids| json         | NO   |     | NULL    |                |
+-----------+--------------+------+-----+---------+----------------+
```

不能直接 `add_index` `json` 欄位，所以會用到 `Sub Index`，的方式：

```SQL
CREATE INDEX linked_ids_index ON targets ((CAST(linked_ids->'$[*]' AS unsigned ARRAY)));
```

在 Rails 內遷移就是：

```Ruby
add_index(:targets, "(CAST(linked_ids->'$[*]' AS unsigned ARRAY))", name: "linked_ids_index")
```

### 查找對象

篩選的時候要用到 `JSON_CONTAINS`，例如這邊查找 `linked_ids` 陣列含有 `4` 的 `target`：

```SQL
SELECT `targets`.* FROM `targets` WHERE (JSON_CONTAINS(linked_ids->'$[*]', '4'));
```

在 Rails 內就得將 `JSON_CONTAINS` 寫進 `where` 參數內：

```Ruby
Target.where("JSON_CONTAINS(linked_ids->'$[*]', ?)", 4)
```

### 對照 Index 前後

可以用 `explain` 來比對加上 Index 前後的效果：

```Ruby
Target.where("JSON_CONTAINS(linked_ids->'$[*]', ?)", 4).explain
```

加 Index 前：

```Text
+----+-------------+---------+------------+------+---------------+------+---------+------+------+----------+-------------+
| id | select_type | table   | partitions | type | possible_keys | key  | key_len | ref  | rows | filtered | Extra       |
+----+-------------+---------+------------+------+---------------+------+---------+------+------+----------+-------------+
|  1 | SIMPLE      | targets | NULL       | ALL  | NULL          | NULL | NULL    | NULL |    2 |    100.0 | Using where |
+----+-------------+---------+------------+------+---------------+------+---------+------+------+----------+-------------+
```

加 Index 後：

```Text
+----+-------------+---------+------------+-------+------------------+------------------+---------+------+------+----------+-------------+
| id | select_type | table   | partitions | type  | possible_keys    | key              | key_len | ref  | rows | filtered | Extra       |
+----+-------------+---------+------------+-------+------------------+------------------+---------+------+------+----------+-------------+
|  1 | SIMPLE      | targets | NULL       | range | linked_ids_index | linked_ids_index | 9       | NULL |    2 |    100.0 | Using where |
+----+-------------+---------+------------+-------+------------------+------------------+---------+------+------+----------+-------------+
```
