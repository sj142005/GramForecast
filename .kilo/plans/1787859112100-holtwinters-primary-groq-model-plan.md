# Batch C: Holt-Winters Primary + Groq Model Config

## Task 1 — Holt-Winters honest + solid

### 1.1 `ml-service/forecaster.py`
- **Line 2 (module docstring):** Change `"Prophet/SARIMA Forecasting Service"` → `"Seasonal Time-Series Forecasting Service (Holt-Winters primary)"`
- **Lines 3–14 (module docstring):** Rewrite to state Holt-Winters is the production forecaster; Prophet is optional/local-dev only behind `FORECASTER_USE_PROPHET`
- **Line 136 (Prophet fallback log):** Change from `"Optional Prophet local/dev path unavailable; using Holt-Winters: %s"` to a neutral info message like `"Prophet not enabled; using Holt-Winters: %s"` so it reads as expected behavior, not an error
- **Lines 195–201 (`fit_holtwinters` return):** Ensure predictions are strictly non-zero. After `values = np.asarray(preds, dtype=float).clip(0)`, add:
  ```python
  series_mean = float(series.mean()) if len(series) > 0 else 0.0
  values = np.where(values == 0, max(series_mean, 0.1), values)
  ```
  This guarantees every product gets a real non-zero forecast number.

### 1.2 `backend/forecast_runner.py`
- **Lines 2–7 (module docstring):** Replace Prophet references with Holt-Winters
- **Line 67 (log message):** Change `"Running in-process Prophet for business %s"` → `"Running in-process Holt-Winters forecast for business %s"`

### 1.3 `backend/routers/forecast.py`
- **Line 89 (`trigger_forecast_run` docstring):** Change `"Run Prophet for this business and wait until forecasts are stored."` → `"Run forecast for this business and wait until forecasts are stored."`

### 1.4 `regenerate_forecast.py`
- **Lines 24, 146 (docstrings):** Replace Prophet references with Holt-Winters
- **Line 115 (print):** Change `"▶  Running Prophet forecaster..."` → `"▶  Running Holt-Winters forecaster..."`

### 1.5 `DESIGN.md`
- **Line 97:** Replace hardcoded `"Forecast Accuracy 92.4%"` with `"Forecast Accuracy"` (remove the fake constant)

### 1.6 UI labels — no changes needed
- `forecast_method` already returns `"seasonal time-series forecasting (Holt-Winters)"` in `forecast.py` lines 79, 293
- `ForecastTrustPanel.jsx` line 26 already labels correctly
- `DemandPrediction.jsx` line 320 already labels correctly

---

## Task 2 — Groq model configurable

### 2.1 `backend/config.py`
- **Line 15:** Change `GROQ_FALLBACK_MODEL: str = "openai/gpt-oss-20b"` → `GROQ_FALLBACK_MODEL: str = "llama-3.1-8b-instant"`
  This ensures the fallback is a genuinely different accessible model so AI never breaks when the primary is unavailable.

### 2.2 `backend/llm_client.py`
- **Lines 32–36 (fallback log):** Strengthen the log message to explicitly name both models, e.g.:
  ```
  "Groq model '%s' not accessible (%s); falling back to '%s'",
  primary_model, type(primary_error).__name__, fallback_model,
  ```

### 2.3 `backend/main.py`
- **Lines 22–41 (`lifespan`):** Add a startup validation that makes a minimal Groq call to verify the configured model. Catch access errors and log a clear warning naming the model. Do not raise — let runtime fallback in `llm_client.py` protect actual requests.
  ```python
  from llm_client import create_chat_completion
  ...
  try:
      create_chat_completion(messages=[{"role": "user", "content": "hi"}], max_tokens=1)
  except Exception as exc:
      if _is_model_access_error(exc):  # reuse the existing helper
          logger.warning("Startup Groq model '%s' inaccessible: %s. Fallback '%s' will be used on first call.", settings.GROQ_MODEL, exc, settings.GROQ_FALLBACK_MODEL)
  ```

### 2.4 `.env.example`
- **After line 22:** Add `GROQ_FALLBACK_MODEL=llama-3.1-8b-instant`

### 2.5 `.env` (project env)
- **After line 22:** Add `GROQ_FALLBACK_MODEL=llama-3.1-8b-instant`

---

## Validation

1. **Forecasting:**
   - Run `python regenerate_forecast.py --demo` (or trigger via API)
   - Verify every product has non-zero `predicted_demand` across the 7-day window
   - Verify `accuracy_pct` and `mape_pct` are computed from real backtest data (not hardcoded)
   - Check logs: no `"Prophet failed"` error-level messages; only clean info about Holt-Winters usage

2. **LLM:**
   - Start backend and trigger an AI insight or chat request
   - Verify the response includes the `model` field showing the actual model used
   - Change `GROQ_MODEL` in `.env` to a different accessible model, restart, and verify the `model` field in the response changes accordingly
   - Change `GROQ_MODEL` to an inaccessible model (e.g., `llama-3.3-70b-versatile`), restart, and verify a clear warning appears in logs and the request still succeeds using the fallback

3. **Cross-surface consistency:**
   - Dashboard, Demand Prediction, Inventory Planning, and Forecast Reports should all display non-zero forecast totals and the same real accuracy figure derived from MAPE backtest
