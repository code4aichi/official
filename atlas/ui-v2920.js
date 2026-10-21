/* v2.9.20: presentation only. Native selectors and workspace events remain intact. */
(() => {
  'use strict';
  const views = {
    map: ['地図から、まちを探す', '色分けで地域の違いを確認。選択した指標の数値を右側に表示します。'],
    basic: ['選んだまちの基本情報', '人口や暮らしの情報を、「詳しく見る」で分野ごとに確認できます。'],
    compare: ['まちを比較', '比較する2自治体を選び、数値とグラフを確認します。対象年度は結果欄に表示します。'],
    ranking: ['ランキングで見る', 'この画面の指標と並び順を選択。上位12自治体と選択中のまちを確認できます。'],
    external: ['追加統計を調べる', '掲載統計を選び、自治体別の数値・産業比較・出典を確認します。調査年は統計ごとに異なります。'],
    discovery: ['2つの指標で特徴を発見', 'おすすめの組み合わせ、または横軸・縦軸を選択。点を選ぶと自治体が切り替わります。'],
    challenge: ['地域の注目点を探す', '探したい視点を選び、2025年の統計で条件に該当する自治体を確認します。'],
    report: ['比較結果をレポートに', '2〜3自治体の2025年統計を比較し、表のコピー・JSON出力・印刷／PDF保存ができます。'],
    'ai-nav': ['地域のデータを質問する', '市町村名と指標を入力して2025年の登録済み統計を検索。下の質問例からも始められます。'],
    trend: ['人口・年齢構成の推移', '上部で選んだ自治体の人口推移と年齢構成を確認します。年度間の定義の違いにもご注意ください。'],
    story: ['数字から、まちの特徴を読む', '選んだ自治体の特徴と集計上の注意を確認し、解説をコピーできます。']
  };
  function install() {
    const shell = document.getElementById('v2918-shell');
    const detail = document.querySelector('#explore .info-column > .detail');
    if (!shell || !detail) return false;
    if (shell.classList.contains('v2920-ready')) return true;
    shell.classList.add('v2920-ready');
    const guide = document.createElement('p');
    guide.className = 'v2920-view-guide';
    guide.id = 'v2920-view-guide';
    shell.querySelector('.v2918-controls').after(guide);
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'v2920-open-basic secondary';
    action.textContent = 'このまちの基本情報を見る →';
    action.addEventListener('click', () => shell.querySelector('.v2918-tab[data-v2918-view="basic"]')?.click());
    detail.append(action);
    const heading = shell.querySelector('.v2918-heading h3');
    const subtitle = shell.querySelector('.v2918-heading p');
    const update = () => {
      const view = shell.dataset.v2918View || 'map';
      const [title, description] = views[view] || views.map;
      heading.textContent = title;
      subtitle.textContent = '地域を探す → 比較・分析 → 発見をまとめる';
      guide.textContent = description;
      shell.querySelector('.workspace').setAttribute('aria-describedby', guide.id);
    };
    new MutationObserver(update).observe(shell, {attributes:true, attributeFilter:['data-v2918-view']});
    update();
    return true;
  }
  function boot() {
    if (install()) return;
    let attempts = 0;
    const timer = setInterval(() => { if (install() || ++attempts >= 30) clearInterval(timer); }, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
