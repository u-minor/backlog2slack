interface BacklogConst {
  types: { [key: number]: string };
  statusColors: { [key: number]: string };
}

export const backlogConst: BacklogConst = {
  types: {
    1: '課題の追加',
    2: '課題の更新',
    3: '課題にコメント',
    4: '課題の削除',
    5: 'Wikiを追加',
    6: 'Wikiを更新',
    7: 'Wikiを削除',
    8: '共有ファイルを追加',
    9: '共有ファイルを更新',
    10: '共有ファイルを削除',
    11: 'Subversionコミット',
    12: 'GITプッシュ',
    13: 'GITリポジトリ作成',
    14: '課題をまとめて更新',
    15: 'プロジェクトに参加',
    16: 'プロジェクトから脱退',
    17: 'コメントにお知らせを追加',
    18: 'プルリクエストの追加',
    19: 'プルリクエストの更新',
    20: 'プルリクエストにコメント',
  },

  statusColors: {
    1: '#ED8077',
    2: '#4488C5',
    3: '#5EB5A6',
    4: '#B0BE3C',
  },
};
