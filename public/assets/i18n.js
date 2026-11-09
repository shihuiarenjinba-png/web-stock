/** Two-language UI, all text stays client-side. Japanese is the default. */
const en={
'単品シミュレーション':'Free analysis','複数商品管理':'Pro workspace','✧ Pro を見る':'✧ Explore Pro',
'需要予測・在庫リスク':'Demand Forecast & Inventory Risk','シミュレーター':'Simulator',
'過去の販売・需要実績をもとに、需要のばらつきと欠品リスクを可視化。':'Visualize demand variability and stockout risk using historical demand.',
'複雑な設定なしで、安全在庫と発注点の判断材料をつくります。':'Estimate safety stock and reorder points without complex setup.',
'ブラウザ内で計算 · データは送信しません':'All calculations run locally · no demand data uploaded',
'需要データの入力':'Demand input','シミュレーション結果':'Simulation results',
'過去の需要データ':'Historical demand data','1日につき1値':'One value per day',
'カンマ / 改行 / スペース区切りに対応 · 0以上':'Comma / newline / space separated · nonnegative',
'基準ライン':'Baseline','単純移動平均':'Simple moving average','全体平均':'Overall mean',
'移動平均の期間':'Moving average window','リードタイム':'Lead time','日数':'days',
'目標サービスレベル':'Target service level','現在庫':'On-hand inventory','任意 · 個数':'optional · units',
'現在庫を入力すると、リードタイム内の在庫切れ確率を推計します。':'Enter stock to estimate the probability of stockout during lead time.',
'▣   手動入力のシミュレーション実行':'▣   Run manual simulation','↻   サンプルデータを読み込む':'↻   Load sample data',
'計算条件':'Model assumptions','未実行':'Not run','需要分布に基づいた在庫リスク分析':'Inventory risk from the simulated demand distribution',
'結果はここに表示されます':'Results will appear here',
'左側に需要データを入力して実行するか、まずはサンプルデータから試してください。':'Upload demand data or load a sample to begin.',
'推奨安全在庫':'Recommended safety stock','推奨発注点':'Reorder point','在庫切れ確率':'Stockout probability','個':'units',
'リードタイム需要の分布':'Lead-time demand distribution','4,000回の試行':'4,000 simulations',
'シミュレーション分布':'Simulated distribution','発注点':'Reorder point','現在庫':'On-hand stock',
'日次の予測基準':'Daily forecast baseline','残差の標準偏差':'Residual standard deviation',
'需要の過去平均':'Historical average demand','リードタイム需要平均':'Mean lead-time demand','標準偏差':'Standard deviation','中央値':'Median',
'需要分布のパーセンタイル':'Demand percentiles','リードタイム需要 · 推計値':'Estimated lead-time demand',
'90%点':'90th percentile','95%点':'95th percentile','99%点':'99th percentile',
'直近需要の基準からの乖離':'Latest demand deviation from baseline','テキスト形式の結果':'Text report','⧉   コピー':'⧉   Copy',
'DemandScope · 需要分析の意思決定支援ツール':'DemandScope · Demand decision support',
'推計値は保証ではありません。販売・入荷・季節性の特殊事情は考慮しません。':'Estimates are not guarantees. Seasonality and unusual deliveries are not modeled.',
'複数商品の在庫リスクを、':'Inventory risk across products,','ひとつの画面で。':'in one workspace.',
'商品を登録して一括シミュレーション。欠品リスクの高い商品と発注点を一覧で比較できます。':'Import a demand table, split product series, and compare stockout risk and reorder points.',
'需要データはブラウザ内に保存':'Demand data stays in this browser',
'複数商品シミュレーション':'Multi-product simulation',
'無料版の計算モデルをそのまま複数商品に適用。商品ごとの在庫リスクをまとめて見られます。':'Run the same simulation model across multiple product demand series.',
'複数SKUの登録・編集・削除':'Add, edit and remove multiple product series',
'一括4,000回シミュレーション':'Batch 4,000-run simulations',
'安全在庫・発注点・欠品確率の比較':'Compare safety stock, reorder point and stockout risk',
'選択商品の分布と結果テキスト':'Distribution and downloadable report for each product',
'🔒 Stripe テスト決済で利用開始':'🔒 Unlock via Stripe test checkout',
'現在はテスト段階です。本番請求は発生しません。価格はStripeテスト設定で決定します。':'This is a test environment. No live charges are made. Pricing is configured in Stripe test mode.',
'テスト決済へ進む':'Open test checkout','契約管理（Stripe）':'Manage subscription (Stripe)','この端末からサインアウト':'Sign out on this device',
'※ データは端末内のブラウザに保存。端末間同期や自動バックアップはありません。':'Data is saved only in this browser. No cross-device sync or automatic backup.',
'商品別リスクダッシュボード':'Product risk dashboard','発注点・推奨安全在庫・欠品確率を比較':'Compare reorder points, safety stock and stockout probability',
'契約を確認中...':'Checking subscription…','登録可能商品':'Product series','複数':'Multiple','一括分析':'Batch analysis','回/商品':'runs/product',
'計算方式':'Model','複数SKUを一画面で管理':'Analyze many series together','決済の確認後、商品登録フォームと比較結果が表示されます。':'After a verified test subscription, import series and compare results.',
'登録商品一覧':'Registered series','商品ごとの設定で一括分析します':'Analyze registered products with individual settings',
'＋ 商品を登録':'＋ Add product','▣ 一括実行':'▣ Run all','商品名 / SKU':'Product / SKU','リードタイム（日）':'Lead time (days)',
'現在庫（任意）':'Inventory (optional)','移動平均（7日）':'Moving average (7 days)',
'サービスレベル (%)':'Service level (%)','移動平均期間（日）':'Moving-average window (days)',
'過去の需要データ（カンマ・改行区切り）':'Historical demand (comma / newline separated)',
'商品を保存':'Save product','キャンセル':'Cancel','商品 / SKU':'Product / SKU','需要平均（日次）':'Mean demand/day',
'安全在庫':'Safety stock','欠品確率':'Stockout risk','設定':'Actions','商品を登録してください。':'Add a product to start.',
'選択商品':'Selected product','需要平均（LT）':'Mean (lead time)','選択商品のリードタイム需要分布':'Lead-time demand of selected product',
'各商品 4,000回':'4,000 runs/product','選択商品の詳細レポート':'Selected product report',
'DemandScope Pro — テスト開発版':'DemandScope Pro — Test version',
'決済権限はStripeから照合。商品データはサーバーにはアップロードされません。':'Subscription status is checked with Stripe; demand data is never sent to our servers.',
'RECOMMENDATION · 推奨在庫水準':'RECOMMENDATION · Suggested inventory levels',
' · モンテカルロ 4,000回 / 正規分布ベース / 各日の需要変動は独立と仮定':' · 4,000 Monte Carlo runs / independent normal daily deviations',
'例：360':'e.g. 360','例：350':'e.g. 350',
'ファイルを読み込む':'Upload demand file','Excel / CSVをアップロード':'Upload Excel / CSV',
'Excel（.xlsx）、CSV、TSVに対応。データは端末内で読み取ります。':'Supports Excel (.xlsx), CSV and TSV. Files are parsed locally.',
'分析するシート':'Worksheet','表の方向':'Data orientation','列ごと':'By column','行ごと':'By row',
'分析する系列（無料版は最大2）':'Select series (Free: up to 2)',
'右側の「現在庫」は各商品の手元にある数量です（任意）。例：2と入力すると現在庫2個として欠品確率を計算します。需要履歴の値や選択数ではありません。未入力なら欠品確率は表示しません。':'The on-hand field is the quantity currently available for each product (optional). Entering 2 means two units in stock for stockout probability. It is not past demand or the number of selected series. Leave blank to omit stockout probability.',
'読み込んだ系列を分析':'Analyze selected series',
'検出された系列':'Detected series','選択した系列':'Selected series',
'ファイルのプレビュー':'File preview','未選択':'None selected',
'結果をCSVで保存':'Download results (CSV)','結果をテキストで保存':'Download report (TXT)',
'サンプルCSVをダウンロード':'Download sample CSV','手動で数値を入力':'Or enter values manually',
'無料版では最大2系列を個別に分析・書き出しできます。3系列目以降はProをご利用ください。':'Free supports up to two demand series per upload. Use Pro for more.',
'Excel / CSVから一括登録':'Bulk import from Excel / CSV',
'ファイル内の系列を検出し、列または行単位で複数登録します。':'Detect series and import each row or column as a product.',
'分割方法':'Import mode','系列ごとに分割':'Split into separate series','同じ期の需要を合算':'Sum aligned periods into one series',
'選択した系列を登録':'Import selected series','系列をすべて選択':'Select all series',
'すべての結果をCSV保存':'Download all results (CSV)',
'ファイルを選択してください。':'Choose a file to continue.',
'登録済みの商品と同名の場合は別系列として追加されます。':'Existing products are not overwritten; duplicate names are added as new entries.',
'ファイルを選択':'Choose file','ファイルが選択されていません':'No file selected',
'まずは3ステップ':'Get started in 3 steps','Excel / CSVを選択':'Choose Excel / CSV','系列を確認して分析':'Review and analyze series','CSV / PDFを保存':'Export CSV / PDF',
'✓ 1列（または1行）が1商品の日々の需要です。日付列は数えません。無料版は2商品まで選択できます。':'✓ Each column (or row) is one product. Date labels are excluded. Free allows up to two series.',
'動作確認用ファイル':'Try sample files','CSV（2商品）':'CSV (2 SKUs)','Excel（5商品）':'Excel (5 SKUs)','行方向CSV':'Rows CSV','PDF出力':'Export PDF',
'Proの操作':'Pro workflow','検出系列を分割または合算':'Split or sum detected series','登録時に自動分析・必要なら一括再計算':'Analyze on import; rerun all when needed',
'テスト用100円/月（Stripeテストカードで支払うため実際の請求はありません）。販売価格ではありません。':'Test checkout: ¥100/month using a Stripe test card only. No real charges. Not the final price.',
'簡易結果を確認':'Review quick results',
'無料版は2系列までの簡易診断です。詳細統計・グラフ・PDF出力・複数商品管理はProで利用できます。':'Free provides quick checks for up to two series. Detailed statistics, charts, PDF exports and multi-product management are available in Pro.',
'無料版は簡易診断のみ':'Free quick check',
'2商品まで、安全在庫・発注点・在庫切れ確率の目安を確認できます。詳細な需要分布、パーセンタイル、PDFレポート、分析条件のカスタマイズはPro専用です。':'Check safety stock, reorder points and stockout probability for up to two products. Full distributions, percentiles, PDF reports and scenario settings are Pro-only.',
'簡易結果をCSV保存':'Download basic CSV',
'Proで詳細分析を見る':'Explore full analysis in Pro',
'簡易診断 / サービスレベル95%固定 / 7日移動平均 / 正規分布・独立需要の仮定':'Quick check / fixed 95% service level / 7-day moving average / independent normal demand assumption',
};
let current='ja';const orig=new WeakMap();
export const lang=()=>current;
export function t(s){return current==='en'?(en[s]??s):s;}
export function initI18n(callback){
 const saved=(()=>{try{return localStorage.getItem('demandscope_lang')}catch{return null}})();
 const q=new URLSearchParams(location.search).get('lang');current=['ja','en'].includes(q)?q:['ja','en'].includes(saved)?saved:'ja';
 const control=document.getElementById('language');if(control){control.value=current;control.addEventListener('change',()=>{current=control.value;try{localStorage.setItem('demandscope_lang',current)}catch{};applyI18n();callback?.();});}
 applyI18n();
}
export function applyI18n(){
 document.documentElement.lang=current;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){
   if(node.parentElement?.closest('script,style,pre,textarea'))continue;
   if(!orig.has(node))orig.set(node,node.textContent);
   const original=orig.get(node),trim=original.trim();if(!en[trim])continue;
   node.textContent=original.replace(trim,t(trim));
 }
 for(const el of document.querySelectorAll('[placeholder],[aria-label]')){
   for(const key of ['placeholder','aria-label']){
      if(!el.hasAttribute(key))continue;
      const data='i18nOriginal'+key.replace('-','');
      if(!el.dataset[data])el.dataset[data]=el.getAttribute(key);
      el.setAttribute(key,t(el.dataset[data]));
   }
 }
 document.title=current==='en'?(location.pathname.startsWith('/pro')?'Pro workspace | DemandScope':'Inventory risk simulator | DemandScope'):(location.pathname.startsWith('/pro')?'Pro | 需要予測・在庫リスク | DemandScope':'需要予測・在庫リスクシミュレーター | DemandScope');
 document.querySelectorAll('a[href="/"],a[href="/pro/"]').forEach(a=>{const url=new URL(a.href);url.searchParams.set('lang',current);a.href=url.pathname+url.search;});
}
export function errorMessage(e){
 const msg=e?.message||String(e);
 if(current==='ja'){
   const ja={file_too_large:'ファイルが大きすぎます。5MB以下のファイルを選んでください。',too_many_rows:'行数が多すぎます（上限10,010行）。',too_many_cells:'表が大きすぎます。',unclosed_quote:'CSVの引用符が閉じられていません。',bad_excel:'Excelファイルを読めません。シート構成を確認してください。',unsupported_file:'対応形式は .xlsx / .csv / .tsv / .txt です（.xls は非対応）。',excel_library_missing:'Excelの読み込みライブラリを利用できません。',empty_sheet:'表に有効な値がありません。',select_series:'分析する系列を1つ以上選択してください。',cannot_sum:'データの期数・欠損位置が異なるため合算できません。'};
   return ja[msg]??msg;
 }
 const err={file_too_large:'File is too large (maximum 5 MB compressed).',too_many_rows:'Too many rows (limit: 10,010).',too_many_cells:'Too many cells in the worksheet.',unclosed_quote:'Unclosed quoted field in CSV.',bad_excel:'Unable to read Excel workbook. Check the worksheet format.',unsupported_file:'Use .xlsx, .csv, .tsv, or .txt (.xls not supported).',excel_library_missing:'The Excel reading library is unavailable.',empty_sheet:'No usable values found in this sheet.',select_series:'Select at least one series.',cannot_sum:'Series have unequal periods or missing data and cannot be summed.'};
 return err[msg]??'Unable to analyze this input. Check the number of daily values, baseline window, stock level and service level. '+(msg.match(/\d+/)?.[0]??'');
}
