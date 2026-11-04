import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFolderTree, defaultTarget, findPathIds, flattenFolders } from '../src/lib/bookmarks.ts';
import type { BookmarkTreeNode } from '../src/lib/bookmarks.ts';

const tree: BookmarkTreeNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: '收藏栏',
        children: [
          {
            id: '10',
            title: '开发',
            children: [
              { id: '100', title: '前端', children: [] },
              { id: '101', title: 'TypeScript 文档', url: 'https://example.com' },
            ],
          },
        ],
      },
      { id: '2', title: '其他收藏', children: [] },
    ],
  },
];

test('只把文件夹作为候选，书签条目被忽略', () => {
  const folders = buildFolderTree(tree);
  assert.deepEqual(folders.map((folder) => folder.id), ['1', '2']);
  assert.deepEqual(folders[0]!.children.map((folder) => folder.id), ['10']);
  assert.deepEqual(folders[0]!.children[0]!.children.map((folder) => folder.id), ['100']);
});

test('路径按层级拼接', () => {
  const folders = flattenFolders(buildFolderTree(tree));
  assert.equal(folders.find((folder) => folder.id === '100')?.path, '收藏栏 / 开发 / 前端');
  assert.equal(folders.find((folder) => folder.id === '2')?.depth, 0);
});

test('默认目标是收藏栏文件夹', () => {
  assert.equal(defaultTarget(buildFolderTree(tree))?.id, '1');
});

test('没有收藏栏时退到第一个文件夹', () => {
  const fallback = buildFolderTree([{ id: '0', title: '', children: [{ id: '7', title: '其他', children: [] }] }]);
  assert.equal(defaultTarget(fallback)?.id, '7');
});

test('空树返回 null', () => {
  assert.equal(defaultTarget([]), null);
});

test('能找到展开推荐用的 id 路径', () => {
  assert.deepEqual(findPathIds(buildFolderTree(tree), '100'), ['1', '10', '100']);
  assert.deepEqual(findPathIds(buildFolderTree(tree), '404'), []);
});
