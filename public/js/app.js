// Main application logic and route optimization algorithm

// Global state
let addresses = [];
let travelTimes = [];
let currentUser = null;
let courierOrders = [];

// Initialize different dashboards based on user role
async function initMerchantDashboard() {
    try {
        // Load addresses for the order form
        await loadAddresses();
        
        // Set minimum datetime for due time input
        setMinDateTimeForInput('due-time');
        
        // Setup order creation form
        const orderForm = document.getElementById('create-order-form');
        if (orderForm) {
            orderForm.addEventListener('submit', handleOrderSubmit);
        }
        
        // Load merchant's orders
        await loadMerchantOrders();
        
    } catch (err) {
        console.error('Error initializing merchant dashboard:', err);
        showMessage('order-message', 'Error loading dashboard data. Please try again later.');
    }
}

async function initCourierDashboard() {
    try {
        // Load addresses for route planning
        await loadAddresses();
        
        // Load travel times for route optimization
        await loadTravelTimes();
        
        // Load available orders
        await loadAvailableOrders();
        
        // Load courier's current orders
        await loadCourierOrders();
        
        // Setup optimize route button
        const optimizeBtn = document.getElementById('optimize-route');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', handleRouteOptimization);
        }
        
        // Initial map rendering
        renderCourierMap();
        
    } catch (err) {
        console.error('Error initializing courier dashboard:', err);
        showMessage('order-message', 'Error loading dashboard data. Please try again later.');
    }
}

async function initAdminDashboard() {
    try {
        // Load users for user management
        await loadUsers();
        
        // Load all orders for order management
        await loadAllOrders();
        
        // Load addresses for address management
        await loadAddresses();
        
        // Setup user form
        setupAdminForms();
        
    } catch (err) {
        console.error('Error initializing admin dashboard:', err);
        showMessage('user-message', 'Error loading dashboard data. Please try again later.');
    }
}

// Data loading functions
async function loadAddresses() {
    try {
        const data = await fetchAPI('/api/addresses');
        addresses = data;
        
        // Populate restaurant dropdown
        const restaurantSelect = document.getElementById('restaurant-address');
        const customerSelect = document.getElementById('customer-address');
        
        if (restaurantSelect) {
            restaurantSelect.innerHTML = '<option value="">-- Select Restaurant --</option>';
            
            data.filter(addr => addr.is_restaurant)
                .forEach(restaurant => {
                    const option = document.createElement('option');
                    option.value = restaurant.id;
                    option.textContent = restaurant.name;
                    restaurantSelect.appendChild(option);
                });
        }
        
        if (customerSelect) {
            customerSelect.innerHTML = '<option value="">-- Select Customer Location --</option>';
            
            data.filter(addr => !addr.is_restaurant)
                .forEach(customer => {
                    const option = document.createElement('option');
                    option.value = customer.id;
                    option.textContent = customer.name;
                    customerSelect.appendChild(option);
                });
        }
        
    } catch (err) {
        console.error('Error loading addresses:', err);
        throw err;
    }
}

async function loadTravelTimes() {
    try {
        const data = await fetchAPI('/api/travel-times');
        travelTimes = data;
        console.log(`Loaded ${travelTimes.length} travel times`);
    } catch (err) {
        console.error('Error loading travel times:', err);
        throw err;
    }
}

async function loadMerchantOrders() {
    try {
        const data = await fetchAPI('/api/orders?role=merchant');
        const ordersTable = document.getElementById('orders-table');
        
        if (ordersTable) {
            ordersTable.innerHTML = '';
            
            if (data.length === 0) {
                ordersTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">No orders found</td></tr>';
                return;
            }
            
            data.forEach(order => {
                const customer = addresses.find(a => a.id === order.customer_address_id)?.name || 'Unknown';
                const restaurant = addresses.find(a => a.id === order.restaurant_address_id)?.name || 'Unknown';
                const courier = order.courier_id ? 'Assigned' : 'Unassigned';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.id}</td>
                    <td>${customer}</td>
                    <td>${restaurant}</td>
                    <td>${formatDateTime(order.due_time)}</td>
                    <td>${order.status}</td>
                    <td>${courier}</td>
                `;
                ordersTable.appendChild(row);
            });
        }
    } catch (err) {
        console.error('Error loading merchant orders:', err);
        showMessage('order-message', 'Error loading orders. Please try again later.');
    }
}

async function loadAvailableOrders() {
    try {
        const data = await fetchAPI('/api/orders?status=pending');
        const ordersTable = document.getElementById('available-orders-table');
        
        if (ordersTable) {
            ordersTable.innerHTML = '';
            
            if (data.length === 0) {
                ordersTable.innerHTML = '<tr><td colspan="5" style="text-align: center;">No available orders</td></tr>';
                return;
            }
            
            data.forEach(order => {
                const customer = addresses.find(a => a.id === order.customer_address_id)?.name || 'Unknown';
                const restaurant = addresses.find(a => a.id === order.restaurant_address_id)?.name || 'Unknown';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.id}</td>
                    <td>${customer}</td>
                    <td>${restaurant}</td>
                    <td>${formatDateTime(order.due_time)}</td>
                    <td><button class="btn btn-small accept-order" data-id="${order.id}">Accept</button></td>
                `;
                ordersTable.appendChild(row);
            });
            
            // Add event listeners to Accept buttons
            document.querySelectorAll('.accept-order').forEach(button => {
                button.addEventListener('click', () => acceptOrder(button.getAttribute('data-id')));
            });
        }
    } catch (err) {
        console.error('Error loading available orders:', err);
        showMessage('order-message', 'Error loading orders. Please try again later.');
    }
}

async function loadCourierOrders() {
    try {
        const data = await fetchAPI('/api/orders?role=courier');
        courierOrders = data;
        const ordersTable = document.getElementById('my-orders-table');
        
        if (ordersTable) {
            ordersTable.innerHTML = '';
            
            if (data.length === 0) {
                ordersTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">No orders assigned</td></tr>';
                return;
            }
            
            data.forEach(order => {
                const customer = addresses.find(a => a.id === order.customer_address_id)?.name || 'Unknown';
                const restaurant = addresses.find(a => a.id === order.restaurant_address_id)?.name || 'Unknown';
                
                let actionButton = '';
                if (order.status === 'accepted') {
                    actionButton = `<button class="btn btn-small start-delivery" data-id="${order.id}">Start Delivery</button>`;
                } else if (order.status === 'in_transit') {
                    actionButton = `<button class="btn btn-small complete-delivery" data-id="${order.id}">Complete</button>`;
                } else {
                    actionButton = 'Completed';
                }
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.id}</td>
                    <td>${customer}</td>
                    <td>${restaurant}</td>
                    <td>${formatDateTime(order.due_time)}</td>
                    <td>${order.status}</td>
                    <td>${actionButton}</td>
                `;
                ordersTable.appendChild(row);
            });
            
            // Add event listeners to action buttons
            document.querySelectorAll('.start-delivery').forEach(button => {
                button.addEventListener('click', () => updateOrderStatus(button.getAttribute('data-id'), 'in_transit'));
            });
            
            document.querySelectorAll('.complete-delivery').forEach(button => {
                button.addEventListener('click', () => updateOrderStatus(button.getAttribute('data-id'), 'delivered'));
            });
        }
    } catch (err) {
        console.error('Error loading courier orders:', err);
        showMessage('order-message', 'Error loading orders. Please try again later.');
    }
}

async function loadUsers() {
    try {
        const data = await fetchAPI('/api/users');
        const usersTable = document.getElementById('users-table');
        
        if (usersTable) {
            usersTable.innerHTML = '';
            
            if (data.length === 0) {
                usersTable.innerHTML = '<tr><td colspan="6" style="text-align: center;">No users found</td></tr>';
                return;
            }
            
            data.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td>${user.email || 'N/A'}</td>
                    <td>${user.role}</td>
                    <td>${formatDateTime(user.created_at)}</td>
                    <td>
                        <button class="btn btn-small edit-user" data-id="${user.id}">Edit</button>
                        <button class="btn btn-small delete-user" data-id="${user.id}">Delete</button>
                    </td>
                `;
                usersTable.appendChild(row);
            });
            
            // Add event listeners for edit and delete
            document.querySelectorAll('.edit-user').forEach(button => {
                button.addEventListener('click', () => editUser(button.getAttribute('data-id')));
            });
            
            document.querySelectorAll('.delete-user').forEach(button => {
                button.addEventListener('click', () => deleteUser(button.getAttribute('data-id')));
            });
        }
    } catch (err) {
        console.error('Error loading users:', err);
        showMessage('user-message', 'Error loading users. Please try again later.');
    }
}

async function loadAllOrders() {
    try {
        const data = await fetchAPI('/api/orders');
        const ordersTable = document.getElementById('all-orders-table');
        
        if (ordersTable) {
            ordersTable.innerHTML = '';
            
            if (data.length === 0) {
                ordersTable.innerHTML = '<tr><td colspan="8" style="text-align: center;">No orders found</td></tr>';
                return;
            }
            
            data.forEach(order => {
                const customer = addresses.find(a => a.id === order.customer_address_id)?.name || 'Unknown';
                const restaurant = addresses.find(a => a.id === order.restaurant_address_id)?.name || 'Unknown';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.id}</td>
                    <td>${order.merchant_id}</td>
                    <td>${order.courier_id || 'Unassigned'}</td>
                    <td>${customer}</td>
                    <td>${restaurant}</td>
                    <td>${formatDateTime(order.due_time)}</td>
                    <td>${order.status}</td>
                    <td>
                        <button class="btn btn-small edit-order" data-id="${order.id}">Edit</button>
                        <button class="btn btn-small delete-order" data-id="${order.id}">Delete</button>
                    </td>
                `;
                ordersTable.appendChild(row);
            });
            
            // Add event listeners for edit and delete
            document.querySelectorAll('.edit-order').forEach(button => {
                button.addEventListener('click', () => editOrder(button.getAttribute('data-id')));
            });
            
            document.querySelectorAll('.delete-order').forEach(button => {
                button.addEventListener('click', () => deleteOrder(button.getAttribute('data-id')));
            });
        }
    } catch (err) {
        console.error('Error loading all orders:', err);
        showMessage('order-message', 'Error loading orders. Please try again later.');
    }
}

// Form handling functions
async function handleOrderSubmit(e) {
    e.preventDefault();
    
    const restaurantId = document.getElementById('restaurant-address').value;
    const customerId = document.getElementById('customer-address').value;
    const dueTime = document.getElementById('due-time').value;
    
    if (!restaurantId || !customerId || !dueTime) {
        showMessage('order-message', 'Please fill in all fields.');
        return;
    }
    
    try {
        const response = await fetchAPI('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                restaurant_address_id: restaurantId,
                customer_address_id: customerId,
                due_time: dueTime
            })
        });
        
        if (response.success) {
            showMessage('order-message', 'Order created successfully!', 'success');
            document.getElementById('create-order-form').reset();
            setMinDateTimeForInput('due-time');
            await loadMerchantOrders();
        } else {
            showMessage('order-message', response.error || 'Failed to create order.');
        }
    } catch (err) {
        console.error('Error creating order:', err);
        showMessage('order-message', 'Error creating order. Please try again.');
    }
}

async function acceptOrder(orderId) {
    try {
        const response = await fetchAPI(`/api/orders/${orderId}/accept`, {
            method: 'POST'
        });
        
        if (response.success) {
            showMessage('order-message', 'Order accepted successfully!', 'success');
            await loadAvailableOrders();
            await loadCourierOrders();
        } else {
            showMessage('order-message', response.error || 'Failed to accept order.');
        }
    } catch (err) {
        console.error('Error accepting order:', err);
        showMessage('order-message', 'Error accepting order. Please try again.');
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetchAPI(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        
        if (response.success) {
            showMessage('order-message', `Order ${status === 'in_transit' ? 'started' : 'completed'} successfully!`, 'success');
            await loadCourierOrders();
        } else {
            showMessage('order-message', response.error || 'Failed to update order status.');
        }
    } catch (err) {
        console.error('Error updating order status:', err);
        showMessage('order-message', 'Error updating order. Please try again.');
    }
}

// New function to release an order back to the available pool
async function releaseOrder(orderId) {
    try {
        const response = await fetchAPI(`/api/orders/${orderId}/release`, {
            method: 'POST'
        });
        
        if (response.success) {
            return true;
        } else {
            console.error('Failed to release order:', response.error);
            return false;
        }
    } catch (err) {
        console.error('Error releasing order:', err);
        return false;
    }
}

function setupAdminForms() {
    // User form
    const addUserBtn = document.getElementById('add-user-btn');
    const userForm = document.getElementById('user-form');
    const cancelAddUser = document.getElementById('cancel-add-user');
    
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            document.getElementById('add-user-form').style.display = 'block';
        });
    }
    
    if (cancelAddUser) {
        cancelAddUser.addEventListener('click', () => {
            document.getElementById('add-user-form').style.display = 'none';
            userForm.reset();
        });
    }
    
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(userForm);
            const userData = {
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                role: formData.get('role')
            };
            
            try {
                const response = await fetchAPI('/api/users', {
                    method: 'POST',
                    body: JSON.stringify(userData)
                });
                
                if (response.success) {
                    showMessage('user-message', 'User added successfully!', 'success');
                    document.getElementById('add-user-form').style.display = 'none';
                    userForm.reset();
                    await loadUsers();
                } else {
                    showMessage('user-message', response.error || 'Failed to add user.');
                }
            } catch (err) {
                console.error('Error adding user:', err);
                showMessage('user-message', 'Error adding user. Please try again.');
            }
        });
    }
    
    // Address form setup
    const addAddressBtn = document.getElementById('add-address-btn');
    const addressForm = document.getElementById('address-form');
    const cancelAddAddress = document.getElementById('cancel-add-address');
    
    if (addAddressBtn) {
        addAddressBtn.addEventListener('click', () => {
            document.getElementById('add-address-form').style.display = 'block';
        });
    }
    
    if (cancelAddAddress) {
        cancelAddAddress.addEventListener('click', () => {
            document.getElementById('add-address-form').style.display = 'none';
            addressForm.reset();
        });
    }
    
    if (addressForm) {
        addressForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(addressForm);
            const addressData = {
                name: formData.get('name'),
                is_restaurant: formData.get('is_restaurant'),
                latitude: formData.get('latitude'),
                longitude: formData.get('longitude')
            };
            
            try {
                const response = await fetchAPI('/api/addresses', {
                    method: 'POST',
                    body: JSON.stringify(addressData)
                });
                
                if (response.success) {
                    showMessage('address-message', 'Address added successfully!', 'success');
                    document.getElementById('add-address-form').style.display = 'none';
                    addressForm.reset();
                    await loadAddresses();
                } else {
                    showMessage('address-message', response.error || 'Failed to add address.');
                }
            } catch (err) {
                console.error('Error adding address:', err);
                showMessage('address-message', 'Error adding address. Please try again.');
            }
        });
    }
}

// Route optimization algorithm
async function handleRouteOptimization() {
    try {
        // Only proceed if we have orders to optimize
        if (courierOrders.length === 0) {
            showMessage('order-message', 'You need to accept orders before optimizing a route.', 'error');
            return;
        }
        
        // Ensure travel times are loaded
        if (travelTimes.length === 0) {
            await loadTravelTimes();
            if (travelTimes.length === 0) {
                showMessage('order-message', 'Could not load travel time data.', 'error');
                return;
            }
        }
        
        // Current time is used as the starting time for the algorithm
        const now = new Date();
        
        // Get restaurant locations and customer locations from orders
        const orderLocations = courierOrders.map(order => {
            return {
                orderId: order.id,
                originalOrderObject: order,  // Store the complete order object
                restaurantId: parseInt(order.restaurant_address_id),
                customerId: parseInt(order.customer_address_id),
                dueTime: new Date(order.due_time).getTime()
            };
        });
        
        // Find the restaurant (assuming all orders are from the same restaurant for simplicity)
        const restaurantId = orderLocations[0].restaurantId;
        
        // Get the optimized route using dynamic programming
        console.time('Route Optimization');
        const optimizedRoute = optimizeDeliveryRouteDynamicProgramming(restaurantId, orderLocations, now.getTime());
        console.timeEnd('Route Optimization');
        
        // Check if there are orders that cannot be delivered on time
        const undeliverableOrders = [];
        const deliverableOrderIds = optimizedRoute.visitedOrders;
        
        // Find orders that couldn't be included in the optimal path
        for (const orderLocation of orderLocations) {
            if (!deliverableOrderIds.includes(orderLocation.orderId)) {
                undeliverableOrders.push(orderLocation.originalOrderObject);
            }
        }
        
        // If there are undeliverable orders, release them back to the available pool
        if (undeliverableOrders.length > 0) {
            const releasePromises = undeliverableOrders.map(order => releaseOrder(order.id));
            await Promise.all(releasePromises);
            
            // Get order names for notification
            const undeliverableOrderNames = undeliverableOrders.map(order => {
                const customerName = addresses.find(a => a.id === order.customer_address_id)?.name || 'Unknown';
                return `#${order.id} (${customerName})`;
            }).join(', ');
            
            showMessage('order-message', 
                `Optimized route created! Warning: ${undeliverableOrders.length} order(s) (${undeliverableOrderNames}) cannot be delivered on time and have been returned to the available pool.`, 
                'warning'
            );
            
            // Reload courier orders and available orders to reflect the changes
            await loadCourierOrders();
            await loadAvailableOrders();
        } else {
            showMessage('order-message', 'Optimized route created! All orders can be delivered on time.', 'success');
        }
        
        // Display the optimized route
        renderOptimizedRoute(optimizedRoute.route, optimizedRoute.totalTime);
        
        // Update the map visualization
        renderRouteOnMap(optimizedRoute.route);
        
    } catch (err) {
        console.error('Error optimizing route:', err);
        showMessage('order-message', 'Error optimizing route. Please try again.');
    }
}

// Dynamic Programming approach for route optimization
function optimizeDeliveryRouteDynamicProgramming(startNodeId, orders, startTime) {
    // If no orders, return a route with just the restaurant
    if (orders.length === 0) {
        return { route: [startNodeId], visitedOrders: [], totalTime: 0 };
    }
    
    // Convert to integers to ensure proper comparison
    startNodeId = parseInt(startNodeId);
    
    // Store all customer IDs for easy access
    const customerIds = orders.map(order => parseInt(order.customerId));
    
    // Add starting node to all locations
    const allLocations = [startNodeId, ...customerIds];
    
    // Create a mapping from customer ID to order index for quick lookup
    const customerToOrderIndex = {};
    orders.forEach((order, index) => {
        customerToOrderIndex[order.customerId] = index;
    });
    
    // Initialize memoization table for dynamic programming
    // Format: memo[bitmask][currentLocation] = { time: bestTime, prev: previousLocation }
    const memo = new Map();
    
    // Helper function to create a key for memoization
    function createKey(mask, currentLoc) {
        return `${mask}-${currentLoc}`;
    }
    
    // Recursive function to find the optimal route
    function findBestRoute(mask, currentLoc, currentTime) {
        // If all customers are visited (all bits in mask are 1)
        if (mask === (1 << orders.length) - 1) {
            // Don't return to restaurant
            return { 
                time: 0, // No return trip time
                prev: -1,
                isValid: true,
                route: [] // Empty route since we don't return to restaurant
            };
        }
        
        // Check if we've already computed this state
        const key = createKey(mask, currentLoc);
        if (memo.has(key)) {
            return memo.get(key);
        }
        
        let bestTime = Infinity;
        let bestPrev = -1;
        let bestRoute = [];
        let isAnyValid = false;
        
        // Try visiting each unvisited customer
        for (let i = 0; i < orders.length; i++) {
            // If customer i is not visited yet (bit i in mask is 0)
            if ((mask & (1 << i)) === 0) {
                const customerId = orders[i].customerId;
                const orderDueTime = orders[i].dueTime;
                
                // Calculate travel time to this customer
                const travelTime = findTravelTime(currentLoc, customerId);
                const arrivalTime = currentTime + travelTime * 60000; // Convert minutes to milliseconds
                
                // Check if we can reach this customer before due time
                if (arrivalTime <= orderDueTime) {
                    // Recursively find the best route after visiting this customer
                    const newMask = mask | (1 << i);
                    const result = findBestRoute(newMask, customerId, arrivalTime);
                    
                    // Only consider valid routes
                    if (result.isValid) {
                        const totalTime = travelTime + result.time;
                        
                        if (totalTime < bestTime) {
                            bestTime = totalTime;
                            bestPrev = i;
                            bestRoute = [customerId, ...result.route];
                            isAnyValid = true;
                        }
                    }
                }
            }
        }
        
        // Store result in memoization table
        const result = {
            time: bestTime,
            prev: bestPrev,
            isValid: isAnyValid,
            route: bestRoute
        };
        memo.set(key, result);
        
        return result;
    }
    
    // Start the algorithm with no customers visited, from the restaurant, at the current time
    const result = findBestRoute(0, startNodeId, startTime);
    
    // If no valid route was found, return empty route
    if (!result.isValid) {
        return { route: [startNodeId], visitedOrders: [], totalTime: 0 };
    }
    
    // Build the complete route
    const finalRoute = [startNodeId, ...result.route];
    
    // Build the list of visited orders
    const visitedOrders = [];
    for (let i = 1; i < finalRoute.length; i++) {
        const customerId = finalRoute[i];
        const orderIndex = customerToOrderIndex[customerId];
        if (orderIndex !== undefined) {
            visitedOrders.push(orders[orderIndex].orderId);
        }
    }
    
    // Calculate actual total time for the route (without returning to restaurant)
    let actualTotalTime = 0;
    for (let i = 0; i < finalRoute.length - 1; i++) {
        actualTotalTime += findTravelTime(finalRoute[i], finalRoute[i + 1]);
    }
    
    return {
        route: finalRoute,
        visitedOrders: visitedOrders,
        totalTime: actualTotalTime
    };
}

function findTravelTime(fromNodeId, toNodeId) {
    // Parse the IDs to integers to ensure consistent comparison
    const fromId = parseInt(fromNodeId);
    const toId = parseInt(toNodeId);
    
    // Special case: same location
    if (fromId === toId) return 0;
    
    // Find the travel time between two nodes from our pre-calculated travel times
    const travelTime = travelTimes.find(
        time => parseInt(time.from_address_id) === fromId && parseInt(time.to_address_id) === toId
    );
    
    if (travelTime) {
        return parseInt(travelTime.time_in_minutes);
    }
    
    // Try to find alternative path (if A->B doesn't exist, try B->A)
    const reverseTravelTime = travelTimes.find(
        time => parseInt(time.from_address_id) === toId && parseInt(time.to_address_id) === fromId
    );
    
    if (reverseTravelTime) {
        console.log(`Using reverse travel time from ${toId} to ${fromId}: ${reverseTravelTime.time_in_minutes} min`);
        return parseInt(reverseTravelTime.time_in_minutes);
    }
    
    // If no direct travel time is found, calculate a realistic fallback based on address locations
    console.error(`No travel time found from ${fromId} to ${toId}, using calculated fallback`);
    
    // Find the address objects
    const fromAddress = addresses.find(addr => addr.id === fromId);
    const toAddress = addresses.find(addr => addr.id === toId);
    
    if (fromAddress && toAddress) {
        // Simple distance calculation (approximation)
        const distance = Math.sqrt(
            Math.pow(fromAddress.latitude - toAddress.latitude, 2) + 
            Math.pow(fromAddress.longitude - toAddress.longitude, 2)
        );
        
        // Convert distance to minutes (rough estimation: 1 distance unit = 10 minutes)
        const estimatedTime = Math.round(distance * 500);
        return Math.max(5, Math.min(30, estimatedTime)); // Between 5-30 minutes
    }
    
    return 15; // Default fallback of 15 minutes if we can't calculate
}

function renderOptimizedRoute(routeIds, totalTime) {
    const routeElement = document.getElementById('optimized-route');
    const timeElement = document.getElementById('total-time');
    
    if (!routeElement || !timeElement) return;
    
    // Convert route IDs to location names
    let routeDescription = '';
    for (let i = 0; i < routeIds.length; i++) {
        const location = addresses.find(addr => addr.id === routeIds[i]);
        if (location) {
            routeDescription += `${i + 1}. ${location.name}`;
            
            // Add travel time to next location if there is one
            if (i < routeIds.length - 1) {
                const nextId = routeIds[i + 1];
                const travelTime = findTravelTime(routeIds[i], nextId);
                routeDescription += ` → (${travelTime} min) → `;
            }
        }
    }
    
    routeElement.innerHTML = routeDescription;
    timeElement.textContent = totalTime;
}

function renderRouteOnMap(routeIds) {
    // Get location objects from route IDs
    const routeLocations = routeIds.map(id => addresses.find(addr => addr.id === id)).filter(Boolean);
    
    // Render the map with the route
    drawSimpleMap('delivery-map', addresses, routeIds);
}

function renderCourierMap() {
    // Simple map rendering without routes initially
    drawSimpleMap('delivery-map', addresses, []);
}
