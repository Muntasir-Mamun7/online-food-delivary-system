// Common functions for the application
const API_BASE_URL = '';

// Navigation between tabs in dashboards
document.addEventListener('DOMContentLoaded', () => {
    // Setup navigation in the dashboard
    setupNavigation();
    
    // Setup logout functionality
    setupLogout();
});

function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = link.getAttribute('data-page');
            
            // Hide all pages
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            
            // Show the selected page
            const selectedPage = document.getElementById(targetPage);
            if (selectedPage) {
                selectedPage.classList.add('active');
            }
            
            // Set the active class on the navigation link
            navLinks.forEach(navLink => {
                navLink.classList.remove('active');
            });
            link.classList.add('active');
        });
    });
}

function setupLogout() {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                });
                
                if (response.ok) {
                    window.location.href = '/login';
                }
            } catch (err) {
                console.error('Logout error:', err);
            }
        });
    }
}

// Utility function to format date and time
function formatDateTime(dateTimeStr) {
    const date = new Date(dateTimeStr);
    return date.toLocaleString();
}

// Utility function to show messages
function showMessage(elementId, message, type = 'error') {
    const messageElement = document.getElementById(elementId);
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message-box ${type}`;
        messageElement.style.display = 'block';
        
        // Hide message after 5 seconds
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 5000);
    }
}

// Function to set a minimum value for datetime-local inputs to prevent past dates
function setMinDateTimeForInput(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        // Set min to current date and time
        const now = new Date();
        
        // Format the datetime for the input
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
        input.min = formattedDateTime;
        
        // Default value - 30 minutes from now
        now.setMinutes(now.getMinutes() + 30);
        const defaultYear = now.getFullYear();
        const defaultMonth = String(now.getMonth() + 1).padStart(2, '0');
        const defaultDay = String(now.getDate()).padStart(2, '0');
        const defaultHours = String(now.getHours()).padStart(2, '0');
        const defaultMinutes = String(now.getMinutes()).padStart(2, '0');
        
        const defaultDateTime = `${defaultYear}-${defaultMonth}-${defaultDay}T${defaultHours}:${defaultMinutes}`;
        input.value = defaultDateTime;
    }
}

// Fetch API wrapper to handle common tasks
async function fetchAPI(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`API Error: ${url}`, error);
        throw error;
    }
}

// Draw a simple map with locations
function drawSimpleMap(containerId, locations, routes) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate boundaries for scaling
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    locations.forEach(loc => {
        minLat = Math.min(minLat, loc.latitude);
        maxLat = Math.max(maxLat, loc.latitude);
        minLng = Math.min(minLng, loc.longitude);
        maxLng = Math.max(maxLng, loc.longitude);
    });
    
    // Add some padding
    const padding = 0.1;
    const latRange = (maxLat - minLat) * (1 + padding);
    const lngRange = (maxLng - minLng) * (1 + padding);
    minLat -= latRange * padding / 2;
    minLng -= lngRange * padding / 2;
    
    // Draw locations
    locations.forEach(loc => {
        const x = ((loc.longitude - minLng) / lngRange) * canvas.width;
        const y = canvas.height - ((loc.latitude - minLat) / latRange) * canvas.height; // Flip Y axis
        
        ctx.beginPath();
        
        // Different colors for different types of locations
        if (loc.is_restaurant) {
            ctx.fillStyle = '#e74c3c'; // Red for restaurant
            ctx.arc(x, y, 10, 0, Math.PI * 2);
        } else {
            ctx.fillStyle = '#3498db'; // Blue for customers
            ctx.arc(x, y, 8, 0, Math.PI * 2);
        }
        
        ctx.fill();
        
        // Add labels
        ctx.fillStyle = '#2c3e50';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(loc.name, x, y - 15);
    });
    
    // Draw routes if provided
    if (routes && routes.length > 0) {
        ctx.strokeStyle = '#27ae60'; // Green for routes
        ctx.lineWidth = 2;
        
        for (let i = 0; i < routes.length - 1; i++) {
            const from = locations.find(loc => loc.id === routes[i]);
            const to = locations.find(loc => loc.id === routes[i + 1]);
            
            if (from && to) {
                const fromX = ((from.longitude - minLng) / lngRange) * canvas.width;
                const fromY = canvas.height - ((from.latitude - minLat) / latRange) * canvas.height;
                const toX = ((to.longitude - minLng) / lngRange) * canvas.width;
                const toY = canvas.height - ((to.latitude - minLat) / latRange) * canvas.height;
                
                ctx.beginPath();
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.stroke();
                
                // Draw arrow for direction
                const angle = Math.atan2(toY - fromY, toX - fromX);
                const arrowSize = 10;
                
                ctx.beginPath();
                ctx.moveTo(toX, toY);
                ctx.lineTo(
                    toX - arrowSize * Math.cos(angle - Math.PI / 6),
                    toY - arrowSize * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                    toX - arrowSize * Math.cos(angle + Math.PI / 6),
                    toY - arrowSize * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fillStyle = '#27ae60';
                ctx.fill();
            }
        }
    }
}