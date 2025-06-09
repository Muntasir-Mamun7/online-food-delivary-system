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
                usersTable.innerHTML = '<tr><td colspan="5" style="text-align: center;">No users found</td></tr>';
                return;
            }
            
            data.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.username}</td>
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
function handleRouteOptimization() {
    try {
        // Only proceed if we have orders to optimize
        if (courierOrders.length === 0) {
            showMessage('order-message', 'You need to accept orders before optimizing a route.', 'error');
            return;
        }
        
        // Get restaurant locations and customer locations from orders
        const orderLocations = courierOrders.map(order => {
            return {
                orderId: order.id,
                restaurantId: order.restaurant_address_id,
                customerId: order.customer_address_id,
                dueTime: new Date(order.due_time).getTime()
            };
        });
        
        // Find the restaurant (assuming all orders are from the same restaurant for simplicity)
        const restaurantId = orderLocations[0].restaurantId;
        
        // Get the optimized route
        const optimizedRoute = optimizeDeliveryRoute(restaurantId, orderLocations);
        
        // Display the optimized route
        renderOptimizedRoute(optimizedRoute.route, optimizedRoute.totalTime);
        
        // Update the map visualization
        renderRouteOnMap(optimizedRoute.route);
        
    } catch (err) {
        console.error('Error optimizing route:', err);
        showMessage('order-message', 'Error optimizing route. Please try again.');
    }
}

function optimizeDeliveryRoute(startNodeId, orders) {
    // Implementation of the algorithm as described in the requirements
    
    // We start at the merchant (restaurant) node
    let existingNodes = new Set([startNodeId]);
    let currentNodeId = startNodeId;
    let currentTime = 0;  // Starting time
    let route = [startNodeId];  // The route starts at the restaurant
    
    // Dictionary to keep track of customer nodes that have been visited
    const visitedCustomers = new Set();
    
    // Keep track of total travel time
    let totalTravelTime = 0;
    
    // Continue until all customer locations are visited or no more valid moves
    while (visitedCustomers.size < orders.length) {
        let bestNextNode = null;
        let bestTravelTime = Infinity;
        let canAddMore = false;
        
        // For each order that hasn't been delivered yet
        for (const order of orders) {
            if (visitedCustomers.has(order.orderId)) {
                continue; // Skip already visited customers
            }
            
            // Check travel time from current location to the customer
            const travelTimeToCustomer = findTravelTime(currentNodeId, order.customerId);
            
            // Check if adding this customer would violate due time
            if (currentTime + travelTimeToCustomer <= order.dueTime) {
                if (travelTimeToCustomer < bestTravelTime) {
                    bestTravelTime = travelTimeToCustomer;
                    bestNextNode = order.customerId;
                    canAddMore = true;
                }
            }
        }
        
        // If no valid move is found, break the loop
        if (!canAddMore) {
            break;
        }
        
        // Add the best node to our route
        existingNodes.add(bestNextNode);
        route.push(bestNextNode);
        currentNodeId = bestNextNode;
        currentTime += bestTravelTime;
        totalTravelTime += bestTravelTime;
        
        // Mark the order as visited (find the order that corresponds to this customer)
        for (const order of orders) {
            if (order.customerId === bestNextNode) {
                visitedCustomers.add(order.orderId);
                break;
            }
        }
    }
    
    // Optional: return to the restaurant at the end
    if (currentNodeId !== startNodeId) {
        const travelTimeBack = findTravelTime(currentNodeId, startNodeId);
        route.push(startNodeId);
        totalTravelTime += travelTimeBack;
    }
    
    return {
        route: route,
        visitedOrders: Array.from(visitedCustomers),
        totalTime: totalTravelTime
    };
}

function findTravelTime(fromNodeId, toNodeId) {
    // Find the travel time between two nodes from our pre-calculated travel times
    const travelTime = travelTimes.find(
        time => time.from_address_id === parseInt(fromNodeId) && time.to_address_id === parseInt(toNodeId)
    );
    
    if (travelTime) {
        return travelTime.time_in_minutes;
    }
    
    // If no direct travel time is found, return a large value
    return 99999;
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