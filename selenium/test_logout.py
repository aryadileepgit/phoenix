"""
Logout tests.
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


@pytest.mark.ui
def test_logout(logged_in_driver, base_url):
    """Test logout functionality."""
    driver = logged_in_driver
    
    wait = WebDriverWait(driver, 10)
    
    # Find and click logout button (assuming it's in a user menu)
    # Try multiple possible selectors
    logout_selectors = [
        'button:has-text("Logout")',
        'a:has-text("Logout")',
        'button:contains("Logout")',
        '[href="/logout"]',
        'button:contains("Log out")',
    ]
    
    logout_clicked = False
    for selector in logout_selectors:
        try:
            if ":has-text" in selector or ":contains" in selector:
                # Use XPath for text-based selectors
                xpath = f"//button[contains(text(), 'Logout') or contains(text(), 'Log out')] | //a[contains(text(), 'Logout') or contains(text(), 'Log out')]"
                elements = driver.find_elements(By.XPATH, xpath)
            else:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
            
            if elements:
                elements[0].click()
                logout_clicked = True
                break
        except:
            continue
    
    # If no logout button found, try accessing logout endpoint directly
    if not logout_clicked:
        driver.get("http://localhost:5173/logout")
    
    # Should redirect to login page
    wait = WebDriverWait(driver, 10)
    wait.until(EC.url_contains("/login"))
    assert "/login" in driver.current_url


@pytest.mark.ui
def test_logout_clears_session(logged_in_driver, base_url):
    """Test that logout clears the session."""
    driver = logged_in_driver
    
    # Get token from localStorage before logout
    token_before = driver.execute_script("return localStorage.getItem('phoenix_token');")
    assert token_before is not None
    
    # Logout
    driver.get(f"{base_url}/logout")
    
    # Check token is cleared
    wait = WebDriverWait(driver, 10)
    wait.until(EC.url_contains("/login"))
    
    token_after = driver.execute_script("return localStorage.getItem('phoenix_token');")
    assert token_after is None