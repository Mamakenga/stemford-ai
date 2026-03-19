# VPS Coders Runbook

Version: 2.0
Date: 2026-03-19
Status: Active

Операционный документ для AI-кодеров на VPS Stemford.
Стратегический контекст — в `plans/PLAN_Deputies_Launch_Opus.md` (§22).

---

## 1. Реестр инструментов

### 1.1 Подписочные CLI (OAuth, $0 за токены)

| # | Инструмент | Модель | Версия CLI | Auth | Подписка | Headless-режим |
|---|-----------|--------|-----------|------|----------|----------------|
| 1 | Codex CLI | GPT-5.4 | 0.115.0 | OAuth (Device Code) | ChatGPT Pro | `codex --model gpt-5.4 "prompt"` |
| 2 | Claude Code | Opus 4.6 / Sonnet 4.6 | 2.1.78 | OAuth (browser redirect) | Claude Pro | `claude -p "prompt" --output-format text` |
| 3 | Gemini CLI | Gemini 3 Pro | 0.34.0 | OAuth (Google Sign-in) | Google One AI Pro | `gemini -p "prompt"` (TBD — TTY issues) |

### 1.2 OpenRouter-модели (API key, оплата за токены)

Один API-ключ OpenRouter (`OPENROUTER_API_KEY`) — доступ ко всем моделям ниже.
Вызов через OpenAI-совместимый endpoint: `https://openrouter.ai/api/v1`.

| # | Model ID | Модель | Контекст | Цена input/output ($/1M tok) | SWE-bench | Заметки |
|---|----------|--------|----------|------------------------------|-----------|---------|
| 4 | `moonshotai/kimi-k2.5` | Kimi K2.5 | 262K | $0.45 / $2.20 | — | Agent swarm paradigm, multimodal |
| 5 | `mistralai/devstral-2512` | Devstral 2 | 262K | $0.40 / $2.00 | — | 123B, специализация agentic coding |
| 6 | `minimax/minimax-m2.5` | MiniMax M2.5 | 196K | $0.20 / $1.20 | 80.2% Verified | Есть free tier: `minimax/minimax-m2.5:free` |
| 7 | `qwen/qwen3-coder-next` | Qwen3-Coder-Next | 262K | $0.12 / $0.75 | — | Apache 2.0, open-source |
| 8 | `xiaomi/mimo-v2-pro` | MiMo-V2-Pro | 1M | $1.00 / $3.00 | — | Огромный контекст |

### 1.3 Qwen Code CLI (отдельный инструмент, резерв)

| # | Инструмент | Модель | Версия CLI | Auth | Headless-режим |
|---|-----------|--------|-----------|------|----------------|
| 9 | Qwen Code | Qwen3-Coder-480B | 0.12.6 | API key only (OAuth не работает headless) | `qwen -p "prompt"` |

Не установлен на VPS. OAuth требует браузер. Бесплатно 1000 req/day через Qwen OAuth (только с десктопа).

### 1.4 Примечания

- Gemini CLI имеет проблемы с TTY на headless VPS (нет поля ввода в интерактивном режиме). Smoke-тест в headless не пройден.
- OpenRouter-модели не требуют отдельных CLI — вызываются через `curl` или любой OpenAI-совместимый клиент.
- Цены OpenRouter актуальны на 2026-03-19, могут меняться. Проверять: `https://openrouter.ai/models`.

---

## 2. Роли

| Роль | Назначение | Базовый инструмент | Модель |
|------|-----------|-------------------|--------|
| **Executor** | Пишет код по prompt-файлу | Codex CLI | GPT-5.4 |
| **Reviewer** | Ревьюит код, выносит verdict P1/P2 | Claude Code | Opus 4.6 |
| **Deployer** | migrate + restart + smoke | bash-скрипт (AI не участвует) | — |

Правила разделения:
- Executor **никогда** не деплоит сам.
- Reviewer **никогда** не пишет код.
- Deployer **никогда** не ревьюит — только pull/restart/smoke/rollback.

---

## 3. Бесшовная ротация моделей

Реальность: при плотной работе недельные лимиты Codex и Claude исчерпываются к четвергу.
Система ротации должна обеспечить **непрерывную** работу без простоев.

### 3.1 Два уровня ротации

**Уровень 1 — Подписки (OAuth, $0 за токены):**

| Приоритет | Инструмент | Модель | Подписка | Лимит | Reset |
|-----------|-----------|--------|---------|-------|-------|
| 1 | Codex CLI | GPT-5.4 | ChatGPT Pro | ~недельный | пн |
| 2 | Claude Code | Sonnet 4.6 | Claude Pro | ~недельный + 5h sliding window | пт |
| 3 | Gemini CLI | Gemini 3 Pro | Google One AI Pro | TBD (не тестировалось) | TBD |

**Уровень 2 — OpenRouter (API key, копейки за токены):**

Включается когда все подписки исчерпаны. Один ключ — все модели.

| Приоритет | Model ID | Модель | Цена за типовой цикл* |
|-----------|----------|--------|-----------------------|
| 4 | `moonshotai/kimi-k2.5` | Kimi K2.5 | ~$0.05–0.15 |
| 5 | `mistralai/devstral-2512` | Devstral 2 | ~$0.04–0.12 |
| 6 | `minimax/minimax-m2.5:free` | MiniMax M2.5 (free) | $0.00 |
| 7 | `qwen/qwen3-coder-next` | Qwen3-Coder-Next | ~$0.02–0.06 |

*Типовой цикл ≈ 10K input + 5K output tokens.

### 3.2 Триггеры переключения

Переключение **только** по явным сигналам:
- HTTP `429`, `limit reached`, `quota exceeded`, `rate_limit_exceeded`
- Таймаут >60 сек без ответа
- **Не** переключать по субъективной оценке качества

### 3.3 Порядок ротации executor

```
Codex (GPT-5.4)
  ↓ лимит
Claude Code (Sonnet 4.6)
  ↓ лимит
Gemini CLI (Gemini 3 Pro)
  ↓ лимит
Kimi K2.5 (OpenRouter)
  ↓ лимит
Devstral 2 (OpenRouter)
  ↓ лимит
MiniMax M2.5 free (OpenRouter)
  ↓ лимит
Qwen3-Coder-Next (OpenRouter)
  ↓ все исчерпаны
[STOP] — ждём reset лимитов, уведомление CEO
```

### 3.4 Матрица reviewer при ротации

Reviewer **всегда** на другом провайдере, чем executor:

| Executor | Reviewer | Почему |
|----------|---------|--------|
| Codex (GPT) | Claude (Opus) | Основная связка |
| Claude (Sonnet) | Kimi K2.5 (OpenRouter) | Разные провайдеры |
| Gemini | Claude (Opus) | Разные провайдеры |
| Kimi K2.5 | Claude (Opus) или Gemini | Разные провайдеры |
| Devstral 2 | Claude (Opus) или Gemini | Разные провайдеры |
| MiniMax M2.5 | Claude (Opus) или Gemini | Разные провайдеры |
| Qwen3-Coder | Claude (Opus) или Gemini | Разные провайдеры |

Принцип: executor и reviewer **никогда** не от одного провайдера.
Если Opus исчерпан для review — fallback reviewer: Kimi K2.5 или Devstral 2 через OpenRouter.

### 3.5 Вызов OpenRouter-моделей

```bash
# Executor через OpenRouter (пример: Kimi K2.5)
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "moonshotai/kimi-k2.5",
    "messages": [{"role": "user", "content": "'"$(cat prompt.txt)"'"}],
    "max_tokens": 8192
  }' | jq -r '.choices[0].message.content'

# Reviewer через OpenRouter (пример: Devstral 2)
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistralai/devstral-2512",
    "messages": [{"role": "user", "content": "Review this diff. First line: Verdict: P1=<n>, P2=<n>.\n\n'"$(git diff HEAD~1)"'"}],
    "max_tokens": 4096
  }' | jq -r '.choices[0].message.content'
```

### 3.6 Ограничения

- Без `P1=0` merge запрещён — quality gate не меняется при ротации.
- Без smoke `PASS` deploy запрещён.
- Для R2/R3-решений: обязателен финальный review `Claude Opus` или ручное подтверждение CEO.
- Не более двух переключений executor в рамках одного handoff.
- OpenRouter-модели для review: verdict должен содержать обоснование каждого P1/P2.

### 3.7 Аудит ротации

Каждый переход фиксируется в `docs/review/HANDOFF_LOG.md` как `Model Rotation Event`:
```
[ROTATION] 2026-03-19 14:30
from: codex/gpt-5.4 -> to: openrouter/kimi-k2.5
reason: 429 rate_limit_exceeded
stage: executor
decided_by: cycle.sh auto / human
```

### 3.8 Конфигурация OpenRouter на VPS

```bash
# Добавить в /opt/stemford/run/.env:
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx

# Проверка:
curl -s https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" | jq '.data | length'
```

---

## 4. Установка на VPS

### 4.1 Claude Code

```bash
npm install -g @anthropic-ai/claude-code
claude --version   # 2.1.78+

# Первый запуск — OAuth через браузер
claude

# Headless-режим:
# Reviewer:
claude -p "Review this diff" --model opus --output-format text \
  --allowedTools "Read,Bash(git show --stat --patch --max-count=1)"

# Deployer (если нужен AI-контроль):
claude -p "Deploy approved changes" --model sonnet --output-format text \
  --allowedTools "Read,Bash(git),Bash(npm test)"
```

Permissions: настроить allowlist в `~/.claude/settings.json`.
**НИКОГДА** не использовать `--dangerously-skip-permissions` в прод-контуре.

### 4.2 Codex CLI

```bash
npm install -g @openai/codex
codex --version   # 0.115.0+

# Первый запуск — OAuth (выбрать "Sign in with Device Code" для headless)
codex

# Executor:
codex --model gpt-5.4 "implement task from HANDOFF_LOG"
```

### 4.3 Gemini CLI

```bash
npm install -g @google/gemini-cli
mkdir -p /root/.gemini   # обязательно перед первым запуском
gemini --version   # 0.34.0

# Первый запуск — OAuth через Google-аккаунт
gemini
```

### 4.4 OpenRouter (API key — один ключ на все модели)

```bash
# 1. Получить ключ: https://openrouter.ai/keys
# 2. Добавить в .env:
echo 'OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx' >> /opt/stemford/run/.env

# 3. Smoke-тест:
source /opt/stemford/run/.env
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"minimax/minimax-m2.5:free","messages":[{"role":"user","content":"echo ok"}],"max_tokens":16}' \
  | jq -r '.choices[0].message.content'
```

Установка CLI не требуется. Все модели вызываются через `curl` к OpenAI-совместимому API.

### 4.5 Qwen Code CLI (не установлен, резерв)

```bash
npm install -g @qwen-code/qwen-code@latest
qwen --version

# На headless — только API key (OAuth требует браузер):
# Настроить в ~/.qwen/settings.json
```

---

## 5. VPS-изоляция (целевая, после MVP)

| Компонент | Linux user | Директория | systemd unit |
|-----------|-----------|-----------|-------------|
| Codex (Executor) | `codex-executor` | `/opt/natalia-ai/executor/` | `natalia-executor.service` |
| Claude Code (Reviewer) | `opus-reviewer` | `/opt/natalia-ai/reviewer/` | `natalia-reviewer.service` |
| Claude Code (Deployer) | `sonnet-deployer` | `/opt/natalia-ai/deployer/` | `natalia-deployer.service` |

Разные OAuth-сессии, разные `.env`, разные права файловой системы.
Executor не имеет прав на production restart. Deployer не имеет прав на git push.

---

## 6. CI/CD Cycle — скрипты

### 6.1 Директории

```bash
mkdir -p /opt/stemford/run/cicd /opt/stemford/run/cicd-logs
```

### 6.2 Скрипт ротации

**`/opt/stemford/run/cicd/run_with_rotation.sh`** — обёртка, которая пробует executor по приоритету:
```bash
#!/usr/bin/env bash
set -euo pipefail
# Использование: run_with_rotation.sh <role> <prompt_file_or_text>
# role: executor | reviewer
# При 429/лимите — автоматически пробует следующий инструмент.

ROLE="$1"
PROMPT="$2"
LOG_DIR="${3:-/tmp}"

source /opt/stemford/run/.env

# Provider mapping (tool -> provider)
declare -A TOOL_PROVIDER=(
  [codex]="openai" [claude]="anthropic" [claude_opus]="anthropic"
  [gemini]="google" [kimi]="moonshot" [devstral]="mistral"
  [minimax_free]="minimax" [qwen_or]="qwen"
)

# Порядок ротации для executor
EXECUTOR_CHAIN=("codex" "claude" "gemini" "kimi" "devstral" "minimax_free" "qwen_or")
# Full reviewer chain (will be filtered by provider exclusion)
REVIEWER_CHAIN_FULL=("claude_opus" "kimi" "devstral" "gemini")

# Build reviewer chain excluding current executor's provider
EXECUTOR_USED=""
if [ -f "$LOG_DIR/rotation.log" ]; then
  EXECUTOR_USED="$(grep 'succeeded' "$LOG_DIR/rotation.log" 2>/dev/null | tail -1 | sed 's/.*Trying: //;s/ .*//')"
fi
EXCLUDED_PROVIDER="${TOOL_PROVIDER[$EXECUTOR_USED]:-}"

REVIEWER_CHAIN=()
for t in "${REVIEWER_CHAIN_FULL[@]}"; do
  if [ -n "$EXCLUDED_PROVIDER" ] && [ "${TOOL_PROVIDER[$t]}" = "$EXCLUDED_PROVIDER" ]; then
    continue
  fi
  REVIEWER_CHAIN+=("$t")
done
# Fallback: if filtering removed everything, use full chain
if [ ${#REVIEWER_CHAIN[@]} -eq 0 ]; then
  REVIEWER_CHAIN=("${REVIEWER_CHAIN_FULL[@]}")
fi

run_codex()        { codex --model gpt-5.4 "$(cat "$PROMPT")" 2>&1; }
run_claude()       { claude -p "$(cat "$PROMPT")" --model sonnet --output-format text 2>&1; }
run_gemini()       { gemini -p "$(cat "$PROMPT")" 2>&1; }
run_claude_opus()  { claude -p "$(cat "$PROMPT")" --model opus --output-format text \
                       --allowedTools "Read,Bash(git show --stat --patch --max-count=1)" 2>&1; }

run_openrouter() {
  local model="$1"
  local prompt_text
  prompt_text="$(cat "$PROMPT")"
  curl -s https://openrouter.ai/api/v1/chat/completions \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg m "$model" --arg p "$prompt_text" \
      '{model:$m, messages:[{role:"user",content:$p}], max_tokens:8192}')" \
    | jq -r '.choices[0].message.content // .error.message // "ERROR: empty response"'
}

run_kimi()         { run_openrouter "moonshotai/kimi-k2.5"; }
run_devstral()     { run_openrouter "mistralai/devstral-2512"; }
run_minimax_free() { run_openrouter "minimax/minimax-m2.5:free"; }
run_qwen_or()      { run_openrouter "qwen/qwen3-coder-next"; }

is_rate_limited() {
  local output="$1"
  echo "$output" | grep -qiE "(rate.limit|429|quota.exceeded|limit.reached|capacity|too.many.requests)"
}

is_hard_error() {
  local output="$1"
  local exit_code="$2"
  # Any non-zero exit that isn't rate-limited = hard error, go to next model
  if [ "$exit_code" -ne 0 ]; then
    return 0
  fi
  # Zero exit but explicit API error in output
  echo "$output" | grep -qiE "(invalid.api.key|model.not.found|unauthorized|forbidden|ENOENT|command.not.found|ERROR:.empty)"
}

is_valid_reviewer_output() {
  local output="$1"
  echo "$output" | grep -qiE "Verdict:[[:space:]]*P[12]="
}

CHAIN_VAR="${ROLE^^}_CHAIN[@]"
CHAIN=("${!CHAIN_VAR}")

for tool in "${CHAIN[@]}"; do
  echo "[ROTATION] Trying: $tool" >> "$LOG_DIR/rotation.log"
  exit_code=0
  output=$(run_$tool 2>&1) || exit_code=$?

  if is_rate_limited "$output"; then
    echo "[ROTATION] $tool hit rate limit, switching..." >> "$LOG_DIR/rotation.log"
    echo "[ROTATION] $tool -> rate limited" >&2
    continue
  fi

  if is_hard_error "$output" "$exit_code"; then
    echo "[ROTATION] $tool hard error (exit=$exit_code), switching..." >> "$LOG_DIR/rotation.log"
    echo "[ROTATION] $tool -> hard error" >&2
    continue
  fi

  # For reviewer: validate that output contains Verdict line
  if [ "$ROLE" = "reviewer" ] && ! is_valid_reviewer_output "$output"; then
    echo "[ROTATION] $tool reviewer output missing Verdict, switching..." >> "$LOG_DIR/rotation.log"
    echo "[ROTATION] $tool -> invalid reviewer output" >&2
    continue
  fi

  echo "[ROTATION] $tool succeeded (exit=$exit_code)" >> "$LOG_DIR/rotation.log"
  echo "$output"
  exit 0
done

echo "[ROTATION] ALL models exhausted. STOP." >> "$LOG_DIR/rotation.log"
echo "[STOP] All executor/reviewer models exhausted." >&2
exit 1
```

### 6.3 Скрипты ролей

**`/opt/stemford/run/cicd/run_executor.sh`**
```bash
#!/usr/bin/env bash
set -euo pipefail
PROMPT_FILE="$1"
LOG_DIR="${2:-/tmp}"
/opt/stemford/run/cicd/run_with_rotation.sh executor "$PROMPT_FILE" "$LOG_DIR"
```

**`/opt/stemford/run/cicd/run_commit.sh`**
```bash
#!/usr/bin/env bash
set -euo pipefail
PROMPT_FILE="$1"
cd /opt/stemford/app/control-api

git add -A
if git diff --cached --quiet; then
  echo "[STOP] Executor produced no file changes. Commit skipped."
  exit 3
fi

SUBJECT="$(head -n 1 "$PROMPT_FILE" | tr -d '\r' | cut -c1-72)"
if [ -z "$SUBJECT" ]; then
  SUBJECT="cycle update"
fi
git commit -m "executor: $SUBJECT"
```

**`/opt/stemford/run/cicd/run_reviewer.sh`**
```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/stemford/app/control-api
LOG_DIR="${1:-/tmp}"

# Создаём prompt-файл для reviewer
REVIEW_PROMPT=$(mktemp)
cat > "$REVIEW_PROMPT" <<'REVIEW_EOF'
Review current changes. First line strictly: Verdict: P1=<n>, P2=<n>. Then findings.
REVIEW_EOF

/opt/stemford/run/cicd/run_with_rotation.sh reviewer "$REVIEW_PROMPT" "$LOG_DIR"
rm -f "$REVIEW_PROMPT"
```

**`/opt/stemford/run/cicd/run_deployer.sh`**
```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/stemford/app/control-api
set -a; source /opt/stemford/run/.env; set +a
npm run migrate
systemctl restart stemford-control-api
sleep 3
bash ./scripts/smoke_scenarios.sh
```

### 6.5 Оркестратор цикла

**`/opt/stemford/run/cicd/cycle.sh`**
```bash
#!/usr/bin/env bash
set -euo pipefail
PROMPT_FILE="${1:-/opt/stemford/run/cicd/prompt.txt}"
TS="$(date +%F_%H-%M-%S)"
LOG_DIR="/opt/stemford/run/cicd-logs/$TS"
mkdir -p "$LOG_DIR"

cd /opt/stemford

echo "[CYCLE] $TS — start" | tee "$LOG_DIR/cycle.log"

# 1. Executor (с автоматической ротацией при лимите)
/usr/bin/script -qefc "/opt/stemford/run/cicd/run_executor.sh \"$PROMPT_FILE\" \"$LOG_DIR\"" "$LOG_DIR/executor.log"

# 2. Commit
/opt/stemford/run/cicd/run_commit.sh "$PROMPT_FILE" | tee "$LOG_DIR/commit.log"

# 3. Reviewer (с автоматической ротацией при лимите)
/opt/stemford/run/cicd/run_reviewer.sh "$LOG_DIR" | tee "$LOG_DIR/reviewer.log"

# 4. Gate: P1=0?
if ! grep -Eq "Verdict:[[:space:]]*P1=0" "$LOG_DIR/reviewer.log"; then
  echo "[STOP] Reviewer verdict blocks deploy (P1>0)." | tee -a "$LOG_DIR/cycle.log"
  echo "Logs: $LOG_DIR"
  exit 2
fi

# 5. Deployer
/opt/stemford/run/cicd/run_deployer.sh | tee "$LOG_DIR/deployer.log"
echo "[OK] Cycle completed. Logs: $LOG_DIR" | tee -a "$LOG_DIR/cycle.log"

# 6. Rotation log
if [ -f "$LOG_DIR/rotation.log" ]; then
  echo "--- Rotation events ---"
  cat "$LOG_DIR/rotation.log"
fi
```

```bash
chmod +x /opt/stemford/run/cicd/run_with_rotation.sh
chmod +x /opt/stemford/run/cicd/run_executor.sh
chmod +x /opt/stemford/run/cicd/run_commit.sh
chmod +x /opt/stemford/run/cicd/run_reviewer.sh
chmod +x /opt/stemford/run/cicd/run_deployer.sh
chmod +x /opt/stemford/run/cicd/cycle.sh
```

### 6.6 Запуск

```bash
/opt/stemford/run/cicd/cycle.sh /opt/stemford/run/cicd/prompt.txt
```

### 6.7 Формат prompt-файла

`/opt/stemford/run/cicd/prompt.txt` должен содержать:
1. Scope одного изменения (минимальный).
2. Запрет на расширение scope.
3. Требование handoff summary (`Changes / Checks / Open risks`).

---

## 7. Поэтапный запуск CI/CD

| Режим | Что работает | Человек делает |
|-------|-------------|---------------|
| **A** (старт) | Codex пишет → Claude ревьюит автоматически | Деплой вручную по команде «да» |
| **B** (после 3-5 успешных циклов) | + автодеплой с approve | Одно слово «approve» в Telegram |
| **C** (после 10+ циклов B) | Полная автономия внутри этапа | Stage gate: начало/конец этапа |

---

## 8. Guardrails

- **Auto-stop:** 2 деплоя подряд откачены, 3 P1 подряд, smoke регрессия.
- **Append-only аудит:** агент не может «подчистить» свой лог.
- **Blast radius policy:** запрещённые операции (DROP TABLE, rm -rf, force push main).
- **Kill switch:** `стоп` в Telegram → весь CI/CD замирает.

---

## 9. Definition of Ready (MVP)

1. `cycle.sh` запускается одной командой без ручного переключения окон.
2. Между executor и reviewer есть обязательный git commit (если изменений нет — цикл останавливается).
3. При `P1>0` deploy гарантированно не выполняется.
4. При `P1=0` smoke завершается с `PASS` и без `FAIL`.
5. Логи пяти шагов (`executor`, `commit`, `reviewer`, `deployer`, `rotation`) лежат в одном каталоге.
6. При исчерпании лимита executor автоматически переключается на следующую модель без ручного вмешательства.
7. OpenRouter smoke-тест проходит минимум для 2 моделей.

---

## 10. Границы MVP

1. Операционный MVP для одного сервера и одного репозитория Stemford.
2. Systemd-юниты для executor/reviewer/deployer — следующий шаг после 3-5 успешных циклов.
3. Auto-rollback и webhook-триггеры — отдельный шаг.
4. Автоматический выбор reviewer в зависимости от текущего executor — следующая итерация (сейчас reviewer fallback chain фиксированный).

---

## 11. Smoke-чеклист (проверка что инструменты живы)

### Подписочные CLI
```bash
# Claude Code
claude -p "echo ok" --output-format text

# Codex CLI
codex --model gpt-5.4 "echo hello"

# Gemini CLI (если установлен)
gemini --version
```

### OpenRouter (все модели через один ключ)
```bash
source /opt/stemford/run/.env

for model in "moonshotai/kimi-k2.5" "mistralai/devstral-2512" "minimax/minimax-m2.5:free" "qwen/qwen3-coder-next"; do
  echo -n "$model: "
  resp=$(curl -s -w "\n%{http_code}" https://openrouter.ai/api/v1/chat/completions \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"'"$model"'","messages":[{"role":"user","content":"Reply with only the word OK"}],"max_tokens":8}' 2>&1)
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | head -n -1)
  if [ "$http_code" = "200" ]; then
    echo "OK ($(echo "$body" | jq -r '.choices[0].message.content' 2>/dev/null))"
  else
    echo "FAIL ($http_code)"
  fi
done
```

---

## 12. Связь слоёв

CI/CD контур обслуживает кодовую базу системы замов. Это разные слои:
- **Замы** (orchestrator, strategy, finance, pmo) — работают с бизнес-задачами Натальи через OpenClaw.
- **CI/CD** (Codex + Claude Code) — разрабатывают и деплоят код Control API, heartbeat-сервиса, дашборда.

Замы не знают о CI/CD. CI/CD не вмешивается в бизнес-логику замов.
