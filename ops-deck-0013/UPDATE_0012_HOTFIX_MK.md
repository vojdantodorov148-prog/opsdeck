# OPS DECK 0012 — Finance TypeScript Hotfix

Овој hotfix ја поправа Netlify build грешката во `src/features/finance/Finance.tsx`.

## Причина
`createFinanceAccount()` враќа `Promise<string>`, додека `updateFinanceAccount()` враќа `Promise<void>`. Во условниот `mutationFn` TypeScript затоа инферираше `Promise<void> | Promise<string>`, а React Query callback-от очекуваше `Promise<void>`.

## Поправка
Finance save mutation сега е `async (): Promise<void>` и ги `await`-ира двете операции без да враќа ID во UI callback-от.

## Инсталација
1. Не пуштај никаков нов SQL — migration 0012 веќе е успешно пуштена.
2. Отпакувај `ops-deck-update-0012-hotfix.zip`.
3. Upload/replace ги фајловите во истиот GitHub repository.
4. Commit message: `OPS DECK 0012 Finance hotfix`.
5. Netlify автоматски ќе започне нов deploy.
6. Ако не започне: Netlify → Deploys → Trigger deploy → Deploy site.
7. Очекувано: `npm run build` повеќе да не ја пријавува TS2322 грешката на Finance.tsx line 235.

Не се потребни нови environment variables.
