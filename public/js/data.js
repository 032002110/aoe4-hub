/* AoE4 静态元数据：文明、段位、模式、地图 */
window.AOE4 = (function () {
  const FLAG = 'https://static.aoe4world.com/assets/flags';

  // 文明：中文名 / 主题色 / 图标
  const CIVS = {
    abbasid_dynasty:      { zh: '阿拔斯王朝',   color: '#4a9d5f' },
    ayyubids:             { zh: '阿尤布王朝',   color: '#c9a227' },
    byzantines:           { zh: '拜占庭帝国',   color: '#7b4bd4' },
    chinese:              { zh: '中国',         color: '#d94f4f' },
    delhi_sultanate:      { zh: '德里苏丹国',   color: '#2fa8a0' },
    english:              { zh: '英格兰',       color: '#d13b6b' },
    french:               { zh: '法兰西',       color: '#3a6fd8' },
    golden_horde:         { zh: '金帐汗国',     color: '#c98a2e' },
    holy_roman_empire:    { zh: '神圣罗马帝国', color: '#8a7a4e' },
    house_of_lancaster:   { zh: '兰开斯特家族', color: '#b03a8f' },
    japanese:             { zh: '日本',         color: '#d8443c' },
    jeanne_darc:          { zh: '贞德',         color: '#e0c15c' },
    jin_dynasty:          { zh: '金朝',         color: '#3f9e8f' },
    knights_templar:      { zh: '圣殿骑士团',   color: '#c7c3b6' },
    macedonian_dynasty:   { zh: '马其顿王朝',   color: '#5b8fd6' },
    malians:              { zh: '马里帝国',     color: '#d98624' },
    mongols:              { zh: '蒙古',         color: '#8e44ad' },
    order_of_the_dragon:  { zh: '龙之骑士团',   color: '#2f7d5c' },
    ottomans:             { zh: '奥斯曼帝国',   color: '#4f8a3f' },
    rus:                  { zh: '罗斯',         color: '#4a76b8' },
    sengoku_daimyo:       { zh: '战国大名',     color: '#a8433a' },
    tughlaq_dynasty:      { zh: '图格鲁克王朝', color: '#6b9c3a' },
    zhu_xis_legacy:       { zh: '朱熹遗产',     color: '#3aa8a0' }
  };

  // 图标哈希由 aoe4world 资源流水线生成，失效时前端回退到色块首字
  const ICONS = {
    abbasid_dynasty: `${FLAG}/abbasid_dynasty-b722e3e4ee862226395c692e73cd14c18bc96c3469874d2e0d918305c70f8a69.png`,
    ayyubids: `${FLAG}/ayyubids-9ba464806c83e293ac43e19e55dddb80f1fba7b7f5bcb6f7e53b48c4b9c83c9e.png`,
    byzantines: `${FLAG}/byzantines-cfe0492a2ed33b486946a92063989a9500ae54d9301178ee55ba6b4d4c7ceb84.png`,
    chinese: `${FLAG}/chinese-2d4edb3d7fc7ab5e1e2df43bd644aba4d63992be5a2110ba3163a4907d0f3d4e.png`,
    delhi_sultanate: `${FLAG}/delhi_sultanate-7f92025d0623b8e224533d9f28b9cd7c51a5ff416ef3edaf7cc3e948ee290708.png`,
    english: `${FLAG}/english-8c6c905d0eb11d6d314b9810b2a0b9c09eec69afb38934f55b329df36468daf2.png`,
    french: `${FLAG}/french-aed0afa1c5843ed8a3d123eb8dda03e63c9ea9a4c74a75424b0bcbb5e429704e.png`,
    golden_horde: `${FLAG}/golden_horde-c99fa291c46ddaea1eb73568291c0687d81136044c97ff660a556bef3b56c06d.png`,
    holy_roman_empire: `${FLAG}/holy_roman_empire-fc0be4151234fc9ac8f83e10c83b4befe79f22f7a8f6ec1ff03745d61adddb4c.png`,
    house_of_lancaster: `${FLAG}/house_of_lancaster-eb59b86336771c7ab996d411a9d12d71045b3639b06753301fde4a3a675b5d40.png`,
    japanese: `${FLAG}/japanese-16a9b5bae87a5494d5a002cf7a2c2c5de5cead128a965cbf3a89eeee8292b997.png`,
    jeanne_darc: `${FLAG}/jeanne_darc-aeec47c19181d6af7b08a015e8a109853d7169d02494b25208d3581e38d022eb.png`,
    jin_dynasty: `${FLAG}/jin_dynasty-47df3dbf923c3cdd6b00da5691517e862dc60b2abc1945c6fa75f8c3f54a28b7.png`,
    knights_templar: `${FLAG}/knights_templar-939b2e79f7a74d99f2cf75756efc9d1db17fd344fbbc86c9bd8c411ef78b2350.png`,
    macedonian_dynasty: `${FLAG}/macedonian_dynasty-835dcf7fc5e8a9c7d35c8d441d3954579e63dab02f3960ef033bccd72c4a457e.png`,
    malians: `${FLAG}/malians-edb6f54659da3f9d0c5c51692fd4b0b1619850be429d67dbe9c3a9d53ab17ddd.png`,
    mongols: `${FLAG}/mongols-7ce0478ab2ca1f95d0d879fecaeb94119629538e951002ac6cb936433c575105.png`,
    order_of_the_dragon: `${FLAG}/order_of_the_dragon-cad6fa9212fd59f9b52aaa83b4a6173f07734d38d37200f976bcd46827667424.png`,
    ottomans: `${FLAG}/ottomans-83c752dcbe46ad980f6f65dd719b060f8fa2d0707ab8e2ddb1ae5d468fc019a2.png`,
    rus: `${FLAG}/rus-05a92d16ef88fd9f9c3b2aff69a0158ae27293b2fcdd1baa0339416d5134c109.png`,
    sengoku_daimyo: `${FLAG}/sengoku_daimyo-047c5091475909b0e159c08768078cd6811ac7a3d2173ac5f497325b1ec549a0.png`,
    tughlaq_dynasty: `${FLAG}/tughlaq_dynasty-4789aaee7cc51e9a24ff4707136eea14366ca5995772a9ee3bc2ac941c40c9d2.png`,
    zhu_xis_legacy: `${FLAG}/zhu_xis_legacy-c4d119a5fc11f2355f41d206a8b65bea8bab2286d09523a81b7d662d1aad0762.png`
  };

  // 段位（对应 API 的 rank_level 参数取值）
  const RANKS = [
    { id: '',              zh: '全部段位', color: '#8b93a7' },
    { id: 'bronze',        zh: '青铜',     color: '#cd7f32' },
    { id: 'silver',        zh: '白银',     color: '#b8c0cc' },
    { id: 'gold',          zh: '黄金',     color: '#f2c744' },
    { id: 'platinum',      zh: '铂金',     color: '#7fd8e8' },
    { id: 'diamond',       zh: '钻石',     color: '#7aa2f7' },
    { id: 'conqueror',     zh: '征服者',   color: '#f7768e' }
  ];

  const RANK_LABEL = {
    unranked: '未定级', bronze_1: '青铜 I', bronze_2: '青铜 II', bronze_3: '青铜 III',
    silver_1: '白银 I', silver_2: '白银 II', silver_3: '白银 III',
    gold_1: '黄金 I', gold_2: '黄金 II', gold_3: '黄金 III',
    platinum_1: '铂金 I', platinum_2: '铂金 II', platinum_3: '铂金 III',
    diamond_1: '钻石 I', diamond_2: '钻石 II', diamond_3: '钻石 III',
    conqueror_1: '征服者 I', conqueror_2: '征服者 II', conqueror_3: '征服者 III'
  };

  const RANK_COLOR = {
    bronze: '#cd7f32', silver: '#b8c0cc', gold: '#f2c744',
    platinum: '#7fd8e8', diamond: '#7aa2f7', conqueror: '#f7768e', unranked: '#6b7280'
  };

  // 注意：aoe4world 两套端点的模式取值并不一致，实测结果如下
  //   stats/{b}/civilizations  -> rm_solo / rm_2v2 / rm_3v3 / rm_4v4 / qm_1v1 / qm_2v2（rm_team 为 404）
  //   leaderboards/{b}         -> rm_solo / rm_team / qm_1v1 / qm_2v2（rm_2v2/3v3/4v4 为 404）
  //   players/{id}/games       -> rm_solo / rm_team / rm_1v1 / rm_2v2 / qm_1v1

  // 文明胜率统计（stats 端点）
  // ranked=false 表示上游忽略 rank_level 参数（快速匹配不分段位，实测 rating 恒为 null）
  const STATS_BOARDS = [
    { id: 'rm_solo', zh: '排位 1v1', ranked: true },
    { id: 'rm_2v2',  zh: '排位 2v2', ranked: true },
    { id: 'rm_3v3',  zh: '排位 3v3', ranked: true },
    { id: 'rm_4v4',  zh: '排位 4v4', ranked: true },
    { id: 'qm_1v1',  zh: '快速 1v1', ranked: false },
    { id: 'qm_2v2',  zh: '快速 2v2', ranked: false }
  ];

  // 天梯榜（leaderboards 端点）
  const LADDER_BOARDS = [
    { id: 'rm_solo', zh: '排位 1v1' },
    { id: 'rm_team', zh: '排位团队' },
    { id: 'qm_1v1',  zh: '快速 1v1' },
    { id: 'qm_2v2',  zh: '快速 2v2' }
  ];

  // 文明对位克制（stats/{b}/matchups，实测仅 1v1 类有数据：rm_solo / qm_1v1）
  const MATCHUP_BOARDS = [
    { id: 'rm_solo', zh: '排位 1v1', ranked: true },
    { id: 'qm_1v1',  zh: '快速 1v1', ranked: false }
  ];

  const boardRanked = (list, id) => {
    const b = list.find(x => x.id === id);
    return b ? b.ranked !== false : true;
  };

  // 战绩筛选（games 端点）
  const GAME_FILTERS = [
    { id: '',        zh: '全部' },
    { id: 'rm_solo', zh: '排位 1v1' },
    { id: 'rm_team', zh: '排位团队' },
    { id: 'qm_1v1',  zh: '快速 1v1' }
  ];

  const BOARDS = STATS_BOARDS;

  // 玩家档案里的模式分组
  const MODES = [
    { id: 'rm_solo',     zh: '排位 1v1',     kind: 'season' },
    { id: 'rm_team',     zh: '排位团队',     kind: 'season' },
    { id: 'rm_1v1',      zh: '排位 1v1(旧)', kind: 'season' },
    { id: 'rm_1v1_elo',  zh: '1v1 ELO',      kind: 'elo' },
    { id: 'rm_2v2_elo',  zh: '2v2 ELO',      kind: 'elo' },
    { id: 'rm_3v3_elo',  zh: '3v3 ELO',      kind: 'elo' },
    { id: 'qm_1v1',      zh: '快速 1v1',     kind: 'elo' }
  ];

  const RESOURCES = [
    { key: 'food',     zh: '食物', color: '#e0a458' },
    { key: 'wood',     zh: '木材', color: '#8b6f47' },
    { key: 'gold',     zh: '黄金', color: '#f2c744' },
    { key: 'stone',    zh: '石头', color: '#9aa5b1' }
  ];

  const SCORES = [
    { key: 'military',   zh: '军事', color: '#f7768e' },
    { key: 'economy',    zh: '经济', color: '#7fd8e8' },
    { key: 'technology', zh: '科技', color: '#bb9af7' },
    { key: 'society',    zh: '社会', color: '#9ece6a' }
  ];

  function civName(id) {
    if (!id) return '随机';
    return (CIVS[id] && CIVS[id].zh) || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  function civColor(id) { return (CIVS[id] && CIVS[id].color) || '#6b7280'; }
  function civIcon(id) { return ICONS[id] || null; }
  function rankLabel(lv) { return RANK_LABEL[lv] || (lv ? lv.replace(/_/g, ' ') : '—'); }
  function rankColor(lv) {
    if (!lv) return RANK_COLOR.unranked;
    return RANK_COLOR[lv.split('_')[0]] || RANK_COLOR.unranked;
  }

  return { CIVS, ICONS, RANKS, RANK_LABEL, RANK_COLOR,
           BOARDS, STATS_BOARDS, LADDER_BOARDS, MATCHUP_BOARDS, GAME_FILTERS,
           MODES, RESOURCES, SCORES,
           boardRanked, civName, civColor, civIcon, rankLabel, rankColor };
})();
