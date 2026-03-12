import numpy as np
import pandas as pd

def run_monte_carlo(current_assets, annual_deposit, years, expected_return, volatility):
    # הגדרות בסיס
    num_simulations = 1000
    returns = np.random.normal(expected_return, volatility, (years, num_simulations))
    
    # חישוב מסלולי הון
    paths = np.zeros((years + 1, num_simulations))
    paths[0] = current_assets
    
    for t in range(1, years + 1):
        paths[t] = (paths[t-1] + annual_deposit) * (1 + returns[t-1])
    
    # יצירת טבלה לגרף
    years_range = [i for i in range(years + 1)]
    p10 = np.percentile(paths, 10, axis=1)
    p50 = np.percentile(paths, 50, axis=1)
    p90 = np.percentile(paths, 90, axis=1)
    
    df_results = pd.DataFrame({
        'שנה': years_range,
        'פסימי (10%)': p10,
        'חציוני (50%)': p50,
        'אופטימי (90%)': p90
    })
    return df_results
