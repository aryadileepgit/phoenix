"""
Login page tests.
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


@pytest.mark.ui
def test_login_page_loads(driver, base_url):
    """Test that login page loads correctly."""
    driver.get(f"{base_url}/login")
    
    wait = WebDriverWait(driver, 10)
    wait.until(EC.presence_of_element_located((By.ID, "email")))
    wait.until(EC.presence_of_element_located((By.ID, "password")))
    
    # Verify page elements
    assert driver.find_element(By.ID, "email").is_displayed()
    assert driver.find_element(By.ID, "password").is_displayed()
    assert driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').is_displayed()


@pytest.mark.ui
def test_login_success(driver, base_url):
    """Test successful login with valid credentials."""
    driver.get(f"{base_url}/login")
    
    wait = WebDriverWait(driver, 10)
    wait.until(EC.presence_of_element_located((By.ID, "email")))
    
    # Fill login form
    driver.find_element(By.ID, "email").send_keys("ayoradileep@gmail.com")
    driver.find_element(By.ID, "password").send_keys("dCrFOlcxBRlMIw3S")
    driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()
    
    # Wait for redirect to dashboard
    wait = WebDriverWait(driver, 15)
    wait.until(EC.url_contains("/dashboard"))
    
    # Verify we're on dashboard
    assert "/dashboard" in driver.current_url


@pytest.mark.ui
def test_login_failure(driver, base_url):
    """Test login failure with invalid credentials."""
    driver.get(f"{base_url}/login")
    
    wait = WebDriverWait(driver, 10)
    wait.until(EC.presence_of_element_located((By.ID, "email")))
    
    # Fill login form with wrong password
    driver.find_element(By.ID, "email").send_keys("ayoradileep@gmail.com")
    driver.find_element(By.ID, "password").send_keys("wrongpassword")
    driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()
    
    # Wait for error message
    wait = WebDriverWait(driver, 10)
    error = wait.until(EC.presence_of_element_located(
        (By.CSS_SELECTOR, ".text-red-400, .text-red-500, [class*='text-red']")
    ))
    
    # Should still be on login page
    assert "/login" in driver.current_url
    assert "Invalid email or password" in driver.page_source


@pytest.mark.ui
def test_login_redirects_if_already_authenticated(logged_in_driver, base_url):
    """Test that authenticated users are redirected from login page."""
    driver = logged_in_driver
    driver.get(f"{base_url}/login")
    
    # Should redirect to dashboard
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    
    wait = WebDriverWait(driver, 10)
    wait.until(lambda d: "/dashboard" in d.current_url)
    assert "/dashboard" in driver.current_url