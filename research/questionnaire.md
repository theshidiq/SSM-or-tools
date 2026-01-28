# Qualitative Research Questionnaire: Shift Scheduling System Comparison
# 質的調査アンケート: シフト作成システム比較

---

## Research Overview / 調査概要

**Objective**: Comparative evaluation of manual shift scheduling vs. OR-Tools CP-SAT optimization system
**目的**: 手動シフト作成とOR-Tools CP-SAT最適化システムの比較評価

**Target**: Restaurant managers and shift scheduling supervisors
**対象者**: レストランマネージャー・シフト管理責任者

**Duration**: Approximately 30-45 minutes
**所要時間**: 約30-45分

**Rating Scale / 評価スケール**:
- 1 = Very Dissatisfied / 非常に不満
- 2 = Dissatisfied / 不満
- 3 = Neutral / 普通
- 4 = Satisfied / 満足
- 5 = Very Satisfied / 非常に満足

---

## Section 1: Time Efficiency
## セクション1: 時間効率

**Q1.1** How long did it take to create one schedule period manually?
手動方式で1期分のシフト作成にかかった平均時間は？

- [ ] Less than 1 hour / 1時間未満
- [ ] 1-2 hours / 1-2時間
- [ ] 2-3 hours / 2-3時間
- [ ] 3-4 hours / 3-4時間
- [ ] More than 4 hours / 4時間以上

**Q1.2** How long does it take with the OR-Tools optimization system?
OR-Tools最適化システムで1期分のシフト作成にかかる平均時間は？

- [ ] Less than 5 minutes / 5分未満
- [ ] 5-10 minutes / 5-10分
- [ ] 10-20 minutes / 10-20分
- [ ] 20-30 minutes / 20-30分
- [ ] More than 30 minutes / 30分以上

**Q1.3** How satisfied are you with the time savings?
時間削減について、どの程度満足していますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Why? / 理由を教えてください**
_________________________________________________________________

_________________________________________________________________

**Q1.4** What were the most time-consuming tasks in manual scheduling? (Multiple choice)
手動方式での主な時間消費タスクは何でしたか？（複数選択可）

- [ ] Collecting staff requests / スタッフの希望を収集する
- [ ] Checking constraints / 制約条件を確認する
- [ ] Creating initial schedule / 初期スケジュールを作成する
- [ ] Correcting errors / エラーを修正する
- [ ] Balancing fairness / 公平性を調整する
- [ ] Distributing to staff / スタッフに配布する
- [ ] Other / その他: _______________

**Q1.5** Which task saves the most time with the optimization system?
最適化システムで最も時間削減を感じる作業は？

_________________________________________________________________

_________________________________________________________________

**Q1.6** Are there still tasks you perform manually?
まだ手動で行っている作業はありますか？

- [ ] Yes → Specify / はい → 具体的に: _________________________
- [ ] No / いいえ

---

## Section 2: Accuracy and Quality
## セクション2: 正確性と品質

**Q2.1** How often did constraint violations occur with manual scheduling?
手動方式で、制約違反（スタッフグループ、勤務上限など）はどのくらい発生しましたか？

- [ ] Almost always / ほぼ毎回
- [ ] Frequently (50%+ of schedules) / 頻繁に (50%以上)
- [ ] Sometimes (20-50%) / 時々 (20-50%)
- [ ] Rarely (< 20%) / まれに (20%未満)
- [ ] Never / 全くない

**Q2.2** How often do constraint violations occur with the OR-Tools system?
OR-Toolsシステムでの制約違反の頻度は？

- [ ] Almost always / ほぼ毎回
- [ ] Frequently (50%+ of schedules) / 頻繁に (50%以上)
- [ ] Sometimes (20-50%) / 時々 (20-50%)
- [ ] Rarely (< 20%) / まれに (20%未満)
- [ ] Never / 全くない

**Q2.3** How satisfied are you with the constraint validation accuracy?
システムの制約チェック精度について、どの程度満足していますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Comments / コメント**:
_________________________________________________________________

_________________________________________________________________

**Q2.4** How would you rate the fairness of manual schedules?
手動方式でのスケジュールの公平性（シフト配分の均等さ）をどう評価しますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q2.5** How would you rate the fairness of OR-Tools generated schedules?
OR-Tools最適化システムでのスケジュールの公平性をどう評価しますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q2.6** Understanding of the CP-SAT solver approach: How well does the system balance hard constraints (must-satisfy) vs soft constraints (preference-based)?
CP-SATソルバーアプローチの理解: システムはハード制約（必須）とソフト制約（希望ベース）をどの程度うまくバランスさせていると感じますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Specific examples / 具体例があれば教えてください**:
_________________________________________________________________

_________________________________________________________________

---

## Section 3: Optimization and Decision Support
## セクション3: 最適化と意思決定支援

**Q3.1** How much do you trust the mathematically optimal solutions from CP-SAT?
CP-SATからの数学的最適解をどの程度信頼していますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q3.2** Is the penalty weight configuration (for soft constraints) useful for customization?
ペナルティ重み設定（ソフト制約用）はカスタマイズに役立っていますか？

- [ ] Very useful / 非常に役立つ
- [ ] Useful / 役立つ
- [ ] Neutral / どちらでもない
- [ ] Not very useful / あまり役立たない
- [ ] Not useful at all / 全く役立たない

**How is it helpful? / どのように役立っていますか？**
_________________________________________________________________

_________________________________________________________________

**Q3.3** Do you use the automatic constraint optimization feature?
自動制約最適化機能を使用していますか？

- [ ] Always use / 常に使用
- [ ] Frequently use / 頻繁に使用
- [ ] Sometimes use / 時々使用
- [ ] Rarely use / まれに使用
- [ ] Never use / 使用しない
- [ ] Not aware of this feature / 機能を知らない

**Q3.4** Has the OR-Tools optimization improved your decision-making quality?
OR-Tools最適化により、より良い意思決定ができるようになりましたか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Specific improvements / 具体的な改善点**:
_________________________________________________________________

_________________________________________________________________

**Q3.5** How often do you need to modify the optimal solutions provided?
提供される最適解を修正する必要性はどのくらいありますか？

- [ ] Always modify / 常に修正
- [ ] Frequently (50%+) / 頻繁に修正 (50%以上)
- [ ] Sometimes (20-50%) / 時々修正 (20-50%)
- [ ] Rarely (<20%) / まれに修正 (20%未満)
- [ ] Never need to modify / 修正不要

**Q3.6** Does the CP-SAT solver adapt to your scheduling preferences over time?
CP-SATソルバーは、時間とともにあなたのスケジューリング設定に適応していると感じますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q3.7** Is manual fine-tuning easy after optimization?
最適化後の手動微調整は簡単ですか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q3.8** Understanding of solution status: Do you understand the difference between OPTIMAL, FEASIBLE, and INFEASIBLE results?
解の状態の理解: OPTIMAL（最適）、FEASIBLE（実行可能）、INFEASIBLE（実行不可能）の結果の違いを理解していますか？

- [ ] Fully understand / 完全に理解
- [ ] Mostly understand / ほぼ理解
- [ ] Somewhat understand / ある程度理解
- [ ] Not really understand / あまり理解していない
- [ ] Do not understand / 理解していない

---

## Section 4: User Experience
## セクション4: ユーザー体験

**Q4.1** How would you rate the usability of manual methods (Excel/paper)?
手動方式（Excel/紙）の使いやすさをどう評価しますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q4.2** How would you rate the usability of the OR-Tools optimization system?
OR-Tools最適化システムの使いやすさをどう評価しますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q4.3** Was the system easy to learn?
システムの学習は簡単でしたか？

- [ ] Very easy / 非常に簡単
- [ ] Easy / 簡単
- [ ] Neutral / 普通
- [ ] Difficult / 難しい
- [ ] Very difficult / 非常に難しい

**How long did it take to become proficient? / どのくらいの期間で慣れましたか？**
_________________________________________________________________

**Q4.4** Is the real-time synchronization feature (multi-user editing) useful?
リアルタイム同期機能（複数人で同時編集）は役立っていますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q4.5** Are you satisfied with the system response time (<100ms)?
システムの応答速度（<100ms）について満足していますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q4.6** Are you satisfied with the system stability (99.9% uptime)?
システムの安定性（99.9%稼働率）について満足していますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q4.7** Have you used the system on mobile devices?
モバイルデバイスでの使用経験はありますか？

- [ ] Yes → Rating / はい → 評価: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
- [ ] No / いいえ

**Q4.8** How clear is the solver output (optimization status, violations, penalties)?
ソルバー出力（最適化状態、違反、ペナルティ）の明確さはどうですか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

---

## Section 5: Business Impact
## セクション5: ビジネスインパクト

**Q5.1** How much staff dissatisfaction was there with manual schedules?
手動シフトに対するスタッフの不満はどのくらいありましたか？

**Rating (1=Lowest, 5=Highest) / 評価 (1=最低, 5=最高)**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q5.2** Has staff satisfaction improved after OR-Tools system implementation?
OR-Toolsシステム導入後、スタッフの満足度は向上しましたか？

- [ ] Significantly improved / 大幅に向上
- [ ] Improved / 向上
- [ ] No change / 変わらない
- [ ] Decreased / 低下
- [ ] Significantly decreased / 大幅に低下

**Specific improvements / 具体的な改善点**:
_________________________________________________________________

_________________________________________________________________

**Q5.3** Have shift change requests decreased?
シフト変更要求は減りましたか？

- [ ] Significantly decreased (50%+) / 大幅に減少 (50%以上)
- [ ] Decreased (20-50%) / 減少 (20-50%)
- [ ] No change / 変わらない
- [ ] Increased / 増加
- [ ] Significantly increased / 大幅に増加

**Q5.4** Have shift-related issues (absences, tardiness) decreased?
シフト関連のトラブル（欠勤、遅刻など）は減りましたか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q5.5** Has your management efficiency improved?
マネージャーとしての業務効率は向上しましたか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**What tasks can you now focus on? / どのような業務に時間を使えるようになりましたか？**
_________________________________________________________________

_________________________________________________________________

**Q5.6** Do you think the system implementation cost was reasonable?
システム導入のコストは妥当だと思いますか？

- [ ] Very reasonable / 非常に妥当
- [ ] Reasonable / 妥当
- [ ] Neutral / どちらでもない
- [ ] Expensive / 高い
- [ ] Very expensive / 非常に高い

**Q5.7** How would you rate the return on investment (ROI)?
投資対効果（ROI）をどう評価しますか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q5.8** How much time do you save annually?
年間でどのくらいの時間を節約できていると感じますか？

- [ ] Less than 10 hours / 10時間未満
- [ ] 10-20 hours / 10-20時間
- [ ] 20-40 hours / 20-40時間
- [ ] 40-60 hours / 40-60時間
- [ ] More than 60 hours / 60時間以上

---

## Section 6: Improvements and Future
## セクション6: 改善と今後

**Q6.1** What would you most like to improve in the OR-Tools system? (Multiple choice)
OR-Toolsシステムで最も改善してほしい点は何ですか？（複数選択可）

- [ ] More accurate constraint modeling / より正確な制約モデリング
- [ ] Faster solver performance / より速いソルバーパフォーマンス
- [ ] More detailed violation reports / より詳細な違反レポート
- [ ] More flexible penalty weight configuration / より柔軟なペナルティ重み設定
- [ ] Staff mobile app / スタッフ向けアプリ
- [ ] More export formats / より多くのエクスポート形式
- [ ] Better solver status explanations / より良いソルバー状態の説明
- [ ] Other / その他: _______________

**Q6.2** Are there any aspects where manual methods were better?
手動方式の方が良かった点はありますか？

- [ ] Yes → Specify / はい → 具体的に: _________________________
- [ ] No / いいえ

**Q6.3** Was the system training/support adequate?
システムトレーニング/サポートは十分でしたか？

**Rating / 評価**: [ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q6.4** Would you recommend this OR-Tools optimization system to other restaurants?
他のレストランにこのOR-Tools最適化システムを推奨しますか？

- [ ] Highly recommend / 強く推奨
- [ ] Recommend / 推奨
- [ ] Neutral / どちらでもない
- [ ] Do not recommend / 推奨しない
- [ ] Definitely do not recommend / 絶対に推奨しない

**Reason / 理由**:
_________________________________________________________________

_________________________________________________________________

**Q6.5** Would you want to continue using this system in 5 years?
5年後もこのシステムを使い続けたいですか？

- [ ] Definitely yes / 絶対に使い続ける
- [ ] Probably yes / おそらく使い続ける
- [ ] Unsure / わからない
- [ ] Probably change / おそらく変更
- [ ] Definitely change / 絶対に変更

**Q6.6** What features do you expect from future constraint optimization advancements?
今後の制約最適化技術の進化により、どのような機能を期待しますか？

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

---

## Section 7: Overall Evaluation
## セクション7: 総合評価

**Q7.1** Overall, which system is better: manual or OR-Tools optimization?
全体的に、手動方式とOR-Tools最適化システムを比較してどちらが優れていますか？

**Rating (1=Manual best, 5=OR-Tools best) / 評価 (1=手動が最良, 5=OR-Toolsが最良)**:
[ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]

**Q7.2** Would you want to go back to manual scheduling?
手動方式に戻りたいと思いますか？

- [ ] Definitely yes / 絶対に戻りたい
- [ ] Probably yes / おそらく戻りたい
- [ ] Neutral / どちらでもない
- [ ] Probably no / おそらく戻りたくない
- [ ] Definitely no / 絶対に戻りたくない

**Q7.3** What are the biggest benefits of the OR-Tools optimization system? (Choose up to 3)
OR-Tools最適化システムの最大のメリットは何ですか？（3つまで選択）

- [ ] Time savings / 時間節約
- [ ] Error reduction / エラー削減
- [ ] Fairness improvement / 公平性向上
- [ ] Staff satisfaction / スタッフ満足度向上
- [ ] Mathematically optimal solutions / 数学的最適解
- [ ] Real-time synchronization / リアルタイム同期
- [ ] Automatic constraint handling / 自動制約処理
- [ ] Penalty-based flexibility / ペナルティベースの柔軟性
- [ ] Other / その他: _______________

**Q7.4** What are the biggest drawbacks of the OR-Tools optimization system?
OR-Tools最適化システムの最大のデメリットは何ですか？

_________________________________________________________________

_________________________________________________________________

**Q7.5** Describe your most challenging experience with manual scheduling.
手動方式での最も困難だった経験を教えてください。

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

**Q7.6** Describe your most impressive experience with the OR-Tools optimization system.
OR-Tools最適化システムで最も印象的だった経験を教えてください。

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

**Q7.7** Any other comments or suggestions about the system?
システムに関するその他のコメントや提案があれば教えてください。

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

---

## Survey Complete / アンケート完了

**Survey Completion Date / 調査完了日**: _____ / _____ / _____

**Respondent Signature (Optional) / 回答者署名（任意）**: _________________

---

### Data Privacy Notice / データプライバシー通知

Survey responses will be used for research purposes only and will not identify individuals.
このアンケートの回答は研究目的でのみ使用され、個人を特定する情報は公開されません。

---

**Thank you for your participation!**
**ご協力ありがとうございました！**

---

*Questionnaire Version 2.0 - OR-Tools CP-SAT Edition*
*Updated: 2026-01-19*
*Previous Version 1.0: 2025-10-31 (Genetic Algorithm)*
