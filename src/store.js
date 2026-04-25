// Supabase + localStorage ハイブリッド管理

import { supabase } from './supabase';

const STORAGE_KEY = 'sheets-manager-data';

export const defaultData = {
  tree: [],
};

// Supabaseからロード（失敗時はlocalStorageにフォールバック）
export async function loadData(userId = 'default') {
  try {
    const { data, error } = await supabase
      .from('trees')
      .select('data')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    const loaded = data.data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    return loaded;
  } catch {
    // ユーザーデータがない場合、'default'データを引き継ぎ
    if (userId !== 'default') {
      try {
        const { data: defaultRow } = await supabase
          .from('trees')
          .select('data')
          .eq('user_id', 'default')
          .single();
        if (defaultRow?.data) {
          await saveData(defaultRow.data, userId);
          return defaultRow.data;
        }
      } catch {}
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultData;
  }
}

// Supabaseに保存（同時にlocalStorageにもキャッシュ）
export async function saveData(data, userId = 'default') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  try {
    await supabase
      .from('trees')
      .upsert(
        { user_id: userId, data, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
  } catch (e) {
    console.warn('Supabase save failed, data saved locally:', e);
  }
}

// ユニークID生成
export function genId() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ツリーから特定IDのノードを検索して操作するユーティリティ
export function findNode(tree, id) {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findParent(tree, id, parent = null) {
  for (const node of tree) {
    if (node.id === id) return parent;
    if (node.children) {
      const found = findParent(node.children, id, node);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function removeNode(tree, id) {
  return tree
    .filter((n) => n.id !== id)
    .map((n) =>
      n.children ? { ...n, children: removeNode(n.children, id) } : n
    );
}

export function insertNode(tree, targetId, node, position = 'inside') {
  if (position === 'inside') {
    return tree.map((n) => {
      if (n.id === targetId && n.type === 'folder') {
        return { ...n, children: [...(n.children || []), node] };
      }
      if (n.children) {
        return { ...n, children: insertNode(n.children, targetId, node, position) };
      }
      return n;
    });
  }
  return tree;
}

export function updateNode(tree, id, updates) {
  return tree.map((n) => {
    if (n.id === id) return { ...n, ...updates };
    if (n.children) return { ...n, children: updateNode(n.children, id, updates) };
    return n;
  });
}

// 同じ階層内で並び替え（fromId を targetId の前後に移動）
export function reorderNode(tree, fromId, targetId, position = 'before') {
  // fromノードを探して取り出す
  let fromNode = null;
  const remove = (nodes) => {
    for (const n of nodes) {
      if (n.id === fromId) { fromNode = n; }
      if (n.children) n.children = remove(n.children);
    }
    return nodes.filter(n => n.id !== fromId);
  };

  const reorder = (nodes) => {
    const idx = nodes.findIndex(n => n.id === targetId);
    if (idx !== -1) {
      const insertAt = position === 'before' ? idx : idx + 1;
      nodes.splice(insertAt, 0, fromNode);
      return nodes;
    }
    return nodes.map(n => n.children ? { ...n, children: reorder([...n.children]) } : n);
  };

  let newTree = remove([...tree.map(n => ({ ...n }))]);
  if (fromNode) newTree = reorder(newTree);
  return newTree;
}
