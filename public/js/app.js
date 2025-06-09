// Add these functions to app.js to handle food item management

// Initialize merchant dashboard
async function initMerchantDashboard() {
    try {
        // Load addresses for the order form
        await loadAddresses();
        
        // Load food items for management
        await loadFoodItems();
        
        // Set minimum datetime for due time input
        setMinDateTimeForInput('due-time');
        
        // Setup order creation form
        const orderForm = document.getElementById('create-order-form');
        if (orderForm) {
            orderForm.addEventListener('submit', handleOrderSubmit);
        }
        
        // Setup food item management
        setupFoodItemManagement();
        
        // Load merchant's orders
        await loadMerchantOrders();
        
    } catch (err) {
        console.error('Error initializing merchant dashboard:', err);
        showMessage('order-message', 'Error loading dashboard data. Please try again later.');
    }
}

// Load food items for merchant
async function loadFoodItems() {
    try {
        const data = await fetchAPI('/api/food-items');
        foodItems = data; // Store in global variable for later use
        
        updateFoodItemsTable();
        updateOrderItemsTable();
    } catch (err) {
        console.error('Error loading food items:', err);
        showMessage('food-message', 'Error loading food items. Please try again later.');
    }
}

// Update the food items table
function updateFoodItemsTable() {
    const foodItemsTable = document.getElementById('food-items-table');
    if (!foodItemsTable) return;
    
    foodItemsTable.innerHTML = '';
    
    if (!foodItems || foodItems.length === 0) {
        foodItemsTable.innerHTML = '<tr><td colspan="6" class="text-center">No food items found. Add some items to get started!</td></tr>';
        return;
    }
    
    foodItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>${item.description || '-'}</td>
            <td>$${parseFloat(item.price).toFixed(2)}</td>
            <td>${item.available_quantity}</td>
            <td>
                <button class="btn btn-small edit-food" data-id="${item.id}">Edit</button>
                <button class="btn btn-small btn-danger delete-food" data-id="${item.id}">Delete</button>
            </td>
        `;
        foodItemsTable.appendChild(row);
    });
    
    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.edit-food').forEach(button => {
        button.addEventListener('click', () => editFoodItem(button.getAttribute('data-id')));
    });
    
    document.querySelectorAll('.delete-food').forEach(button => {
        button.addEventListener('click', () => deleteFoodItem(button.getAttribute('data-id')));
    });
}

// Update the order items table for order creation
function updateOrderItemsTable() {
    const orderItemsTable = document.getElementById('order-items-table');
    if (!orderItemsTable) return;
    
    orderItemsTable.innerHTML = '';
    
    if (!foodItems || foodItems.length === 0) {
        orderItemsTable.innerHTML = '<tr><td colspan="5" class="text-center">No food items available to order. Please add some food items first.</td></tr>';
        return;
    }
    
    foodItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>$${parseFloat(item.price).toFixed(2)}</td>
            <td>${item.available_quantity}</td>
            <td>
                <input type="number" class="quantity-input" data-id="${item.id}" data-price="${item.price}" min="0" max="${item.available_quantity}" value="0">
            </td>
            <td class="item-subtotal" data-id="${item.id}">$0.00</td>
        `;
        orderItemsTable.appendChild(row);
    });
    
    // Add event listeners for quantity inputs
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('change', updateOrderTotal);
        input.addEventListener('input', updateOrderTotal);
    });
}

// Calculate and update order total
function updateOrderTotal() {
    let total = 0;
    
    document.querySelectorAll('.quantity-input').forEach(input => {
        const id = input.getAttribute('data-id');
        const price = parseFloat(input.getAttribute('data-price'));
        const quantity = parseInt(input.value, 10) || 0;
        const subtotal = price * quantity;
        
        total += subtotal;
        
        // Update subtotal display
        const subtotalElement = document.querySelector(`.item-subtotal[data-id="${id}"]`);
        if (subtotalElement) {
            subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
        }
    });
    
    // Update total display
    const totalElement = document.getElementById('order-total');
    if (totalElement) {
        totalElement.textContent = `$${total.toFixed(2)}`;
    }
}

// Setup food item management UI interactions
function setupFoodItemManagement() {
    // Add new food item button
    const addFoodBtn = document.getElementById('add-food-btn');
    const foodForm = document.getElementById('food-form');
    const cancelAddFood = document.getElementById('cancel-add-food');
    
    if (addFoodBtn) {
        addFoodBtn.addEventListener('click', () => {
            document.getElementById('add-food-form').style.display = 'block';
        });
    }
    
    if (cancelAddFood) {
        cancelAddFood.addEventListener('click', () => {
            document.getElementById('add-food-form').style.display = 'none';
            foodForm.reset();
        });
    }
    
    if (foodForm) {
        foodForm.addEventListener('submit', handleAddFoodItem);
    }
    
    // Edit food item form
    const editFoodForm = document.getElementById('edit-food-form');
    const cancelEditFood = document.getElementById('cancel-edit-food');
    
    if (cancelEditFood) {
        cancelEditFood.addEventListener('click', () => {
            document.getElementById('edit-food-form').style.display = 'none';
        });
    }
    
    if (editFoodForm) {
        editFoodForm.addEventListener('submit', handleEditFoodItem);
    }
}

// Add new food item
async function handleAddFoodItem(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const foodData = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: parseFloat(formData.get('price')),
        available_quantity: parseInt(formData.get('available_quantity'), 10)
    };
    
    try {
        const response = await fetchAPI('/api/food-items', {
            method: 'POST',
            body: JSON.stringify(foodData)
        });
        
        if (response.success) {
            showMessage('food-message', 'Food item added successfully!', 'success');
            document.getElementById('add-food-form').style.display = 'none';
            document.getElementById('food-form').reset();
            await loadFoodItems();
        } else {
            showMessage('food-message', response.error || 'Failed to add food item.');
        }
    } catch (err) {
        console.error('Error adding food item:', err);
        showMessage('food-message', 'Error adding food item. Please try again.');
    }
}

// Edit food item
function editFoodItem(id) {
    const item = foodItems.find(item => item.id === parseInt(id, 10));
    if (!item) {
        showMessage('food-message', 'Food item not found');
        return;
    }
    
    // Fill the edit form
    document.getElementById('edit-food-id').value = item.id;
    document.getElementById('edit-food-name').value = item.name;
    document.getElementById('edit-food-description').value = item.description || '';
    document.getElementById('edit-food-price').value = item.price;
    document.getElementById('edit-food-quantity').value = item.available_quantity;
    
    // Show the edit form
    document.getElementById('edit-food-form').style.display = 'block';
}

// Handle edit food item form submission
async function handleEditFoodItem(e) {
    e.preventDefault();
    
    const id = document.getElementById('edit-food-id').value;
    const formData = new FormData(e.target);
    const foodData = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: parseFloat(formData.get('price')),
        available_quantity: parseInt(formData.get('available_quantity'), 10)
    };
    
    try {
        const response = await fetchAPI(`/api/food-items/${id}`, {
            method: 'PUT',
            body: JSON.stringify(foodData)
        });
        
        if (response.success) {
            showMessage('food-message', 'Food item updated successfully!', 'success');
            document.getElementById('edit-food-form').style.display = 'none';
            await loadFoodItems();
        } else {
            showMessage('food-message', response.error || 'Failed to update food item.');
        }
    } catch (err) {
        console.error('Error updating food item:', err);
        showMessage('food-message', 'Error updating food item. Please try again.');
    }
}

// Delete food item
async function deleteFoodItem(id) {
    if (!confirm('Are you sure you want to delete this food item?')) {
        return;
    }
    
    try {
        const response = await fetchAPI(`/api/food-items/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showMessage('food-message', 'Food item deleted successfully!', 'success');
            await loadFoodItems();
        } else {
            showMessage('food-message', response.error || 'Failed to delete food item.');
        }
    } catch (err) {
        console.error('Error deleting food item:', err);
        showMessage('food-message', 'Error deleting food item. Please try again.');
    }
}

// Modified order submission to include food items
async function handleOrderSubmit(e) {
    e.preventDefault();
    
    const restaurantId = document.getElementById('restaurant-address').value;
    const customerId = document.getElementById('customer-address').value;
    const dueTime = document.getElementById('due-time').value;
    
    if (!restaurantId || !customerId || !dueTime) {
        showMessage('order-message', 'Please fill in all required fields.');
        return;
    }
    
    // Get selected food items
    const orderItems = [];
    let hasItems = false;
    
    document.querySelectorAll('.quantity-input').forEach(input => {
        const quantity = parseInt(input.value, 10) || 0;
        if (quantity > 0) {
            hasItems = true;
            orderItems.push({
                food_item_id: parseInt(input.getAttribute('data-id'), 10),
                quantity: quantity
            });
        }
    });
    
    if (!hasItems) {
        showMessage('order-message', 'Please select at least one food item for the order.');
        return;
    }
    
    try {
        const response = await fetchAPI('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                restaurant_address_id: restaurantId,
                customer_address_id: customerId,
                due_time: dueTime,
                items: orderItems
            })
        });
        
        if (response.success) {
            showMessage('order-message', `Order created successfully with total: $${parseFloat(response.total_price).toFixed(2)}`, 'success');
            document.getElementById('create-order-form').reset();
            setMinDateTimeForInput('due-time');
            
            // Reset food item quantities
            document.querySelectorAll('.quantity-input').forEach(input => {
                input.value = 0;
            });
            updateOrderTotal();
            
            // Reload food items and orders
            await loadFoodItems();
            await loadMerchantOrders();
            
        } else {
            showMessage('order-message', response.error || 'Failed to create order.');
        }
    } catch (err) {
        console.error('Error creating order:', err);
        showMessage('order-message', 'Error creating order. Please try again.');
    }
}

// Modified order loading to include total price
async function loadMerchantOrders() {
    try {
        const data = await fetchAPI('/api/orders?role=merchant');
        const ordersTable = document.getElementById('orders-table');
        
        if (ordersTable) {
            ordersTable.innerHTML = '';
            
            if (data.length === 0) {
                ordersTable.innerHTML = '<tr><td colspan="7" style="text-align: center;">No orders found</td></tr>';
                return;
            }
            
            data.forEach(order => {
                const customer = order.customer_name || 'Unknown';
                const restaurant = order.restaurant_name || 'Unknown';
                const courier = order.courier_id ? 'Assigned' : 'Unassigned';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.id}</td>
                    <td>${customer}</td>
                    <td>${restaurant}</td>
                    <td>${formatDateTime(order.due_time)}</td>
                    <td>$${parseFloat(order.total_price).toFixed(2)}</td>
                    <td>${order.status}</td>
                    <td><button class="btn btn-small view-order" data-id="${order.id}">View</button></td>
                `;
                ordersTable.appendChild(row);
            });
            
            // Add event listeners for View buttons
            document.querySelectorAll('.view-order').forEach(button => {
                button.addEventListener('click', () => viewOrderDetails(button.getAttribute('data-id')));
            });
        }
    } catch (err) {
        console.error('Error loading merchant orders:', err);
        showMessage('order-message', 'Error loading orders. Please try again later.');
    }
}

// View order details
async function viewOrderDetails(orderId) {
    try {
        const order = await fetchAPI(`/api/orders/${orderId}`);
        alert(`
            Order #${order.id}
            Customer: ${order.customer_name}
            Restaurant: ${order.restaurant_name}
            Due Time: ${formatDateTime(order.due_time)}
            Status: ${order.status}
            Total Price: $${parseFloat(order.total_price).toFixed(2)}
            
            Items:
            ${order.items.map(item => `- ${item.name}: ${item.quantity} x $${parseFloat(item.unit_price).toFixed(2)}`).join('\n')}
        `);
    } catch (err) {
        console.error('Error loading order details:', err);
        showMessage('order-message', 'Error loading order details.');
    }
}
