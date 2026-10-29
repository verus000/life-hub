/* 轻量 SVG 图表，无外部依赖 */
window.Charts = (function () {

  const PALETTE = ['#5271E8', '#78A1EE', '#6BB8A4', '#E5B87E', '#A493D2', '#80B7CE', '#BF927C', '#9CA6BA'];

  function colorAt(i) { return PALETTE[i % PALETTE.length]; }

  function donut(data, opts) {
    const o = opts || {};
    const size = o.size || 190;
    const R = size / 2 - 4;
    const r = R * 0.76;
    const c = size / 2;
    const total = data.reduce((s, d) => s + d.value, 0);

    if (!data.length || total <= 0) {
      return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="暂无资产数据">' +
        '<circle cx="' + c + '" cy="' + c + '" r="' + R + '" fill="none" stroke="#E4E8EE" stroke-width="' + (R - r) + '"/></svg>';
    }

    const pt = (ang, rad) => {
      const a = (ang - 90) * Math.PI / 180;
      return [(c + rad * Math.cos(a)).toFixed(2), (c + rad * Math.sin(a)).toFixed(2)];
    };

    if (data.length === 1) {
      return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="资产分布环形图，单一类别">' +
        '<circle cx="' + c + '" cy="' + c + '" r="' + ((R + r) / 2) + '" fill="none" stroke="' + data[0].color + '" stroke-width="' + (R - r) + '"/></svg>';
    }

    let ang = 0, paths = '';
    data.forEach(d => {
      const sweep = d.value / total * 360;
      const large = sweep > 180 ? 1 : 0;
      const s1 = pt(ang, R), s2 = pt(ang + sweep, R);
      const e1 = pt(ang + sweep, r), e2 = pt(ang, r);
      paths += '<path d="M' + s1[0] + ' ' + s1[1] +
        ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + s2[0] + ' ' + s2[1] +
        ' L' + e1[0] + ' ' + e1[1] +
        ' A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + e2[0] + ' ' + e2[1] +
        ' Z" fill="' + d.color + '" stroke="#FFFFFF" stroke-width="1.5"/>';
      ang += sweep;
    });

    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="资产分布环形图">' + paths + '</svg>';
  }

  function groupBy(items, path) {
    const map = {};
    items.forEach(it => {
      const k = Model.get(it, path) || '未分类';
      map[k] = (map[k] || 0) + (Number(it.amount) || 0);
    });
    return Object.keys(map)
      .map(k => ({ name: k, value: map[k] }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  return { donut, colorAt, groupBy, PALETTE };
})();
