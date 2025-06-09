// Add these new API routes for food item management to the server.js file 
// (keep all the existing code, just add these new routes)

// Get food items for a merchant dfd
app.get('/api/food-items', (req, res) => {
  const merchantId = req.query.merchant_id || (req.session.user && req.session.user.role === 'merchant' ? req.session.user.id : null);
  
  if (!merchantId) {
    return res.status(400).json({ error: 'Merchant ID is required' });
  }
  
  db.all('SELECT * FROM food_items WHERE merchant_id = ? ORDER BY name', [merchantId], (err, items) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch food items' });
    }
    res.json(items);
  });
});

// Add a new food item (for merchants)
app.post('/api/food-items', checkAuthentication('merchant'), (req, res) => {
  const { name, description, price, available_quantity } = req.body;
  const merchantId = req.session.user.id;
  
  // Validate input
  if (!name || price === undefined || available_quantity === undefined) {
    return res.status(400).json({ error: 'Name, price, and available quantity are required' });
  }
  
  db.run(
    'INSERT INTO food_items (merchant_id, name, description, price, available_quantity) VALUES (?, ?, ?, ?, ?)',
    [merchantId, name, description || '', price, available_quantity],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to add food item' });
      }
      
      res.status(201).json({
        success: true,
        item_id: this.lastID,
        message: 'Food item added successfully'
      });
    }
  );
});

// Update a food item (for merchants)
app.put('/api/food-items/:id', checkAuthentication('merchant'), (req, res) => {
  const itemId = req.params.id;
  const { name, description, price, available_quantity } = req.body;
  const merchantId = req.session.user.id;
  
  // Validate ownership
  db.get('SELECT * FROM food_items WHERE id = ? AND merchant_id = ?', [itemId, merchantId], (err, item) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to verify food item ownership' });
    }
    
    if (!item) {
      return res.status(404).json({ error: 'Food item not found or you do not have permission to edit it' });
    }
    
    // Update the item
    db.run(
      'UPDATE food_items SET name = ?, description = ?, price = ?, available_quantity = ? WHERE id = ?',
      [name || item.name, description !== undefined ? description : item.description, 
       price !== undefined ? price : item.price, 
       available_quantity !== undefined ? available_quantity : item.available_quantity, 
       itemId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update food item' });
        }
        
        res.json({
          success: true,
          message: 'Food item updated successfully'
        });
      }
    );
  });
});

// Delete a food item (for merchants)
app.delete('/api/food-items/:id', checkAuthentication('merchant'), (req, res) => {
  const itemId = req.params.id;
  const merchantId = req.session.user.id;
  
  // Validate ownership
  db.get('SELECT * FROM food_items WHERE id = ? AND merchant_id = ?', [itemId, merchantId], (err, item) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to verify food item ownership' });
    }
    
    if (!item) {
      return res.status(404).json({ error: 'Food item not found or you do not have permission to delete it' });
    }
    
    // Delete the item
    db.run('DELETE FROM food_items WHERE id = ?', [itemId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete food item' });
      }
      
      res.json({
        success: true,
        message: 'Food item deleted successfully'
      });
    });
  });
});

// Update the create order endpoint to handle food items
app.post('/api/orders', checkAuthentication('merchant'), (req, res) => {
  const { customer_address_id, restaurant_address_id, due_time, items } = req.body;
  const merchant_id = req.session.user.id;
  
  // Validate basic order info
  if (!customer_address_id || !restaurant_address_id || !due_time) {
    return res.status(400).json({ error: 'Customer address, restaurant address, and due time are required' });
  }
  
  // Validate items (must have at least one item)
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one food item must be included in the order' });
  }
  
  // Start a transaction to ensure data consistency
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    let totalPrice = 0;
    const itemPromises = [];
    
    // Verify and calculate the total price for each item
    items.forEach(item => {
      itemPromises.push(
        new Promise((resolve, reject) => {
          db.get(
            'SELECT price, available_quantity FROM food_items WHERE id = ? AND merchant_id = ?',
            [item.food_item_id, merchant_id],
            (err, foodItem) => {
              if (err) {
                return reject(err);
              }
              
              if (!foodItem) {
                return reject(new Error(`Food item with ID ${item.food_item_id} not found or does not belong to this merchant`));
              }
              
              if (foodItem.available_quantity < item.quantity) {
                return reject(new Error(`Insufficient quantity available for food item with ID ${item.food_item_id}`));
              }
              
              const itemTotal = foodItem.price * item.quantity;
              totalPrice += itemTotal;
              
              // Update the available quantity
              db.run(
                'UPDATE food_items SET available_quantity = available_quantity - ? WHERE id = ?',
                [item.quantity, item.food_item_id],
                (err) => {
                  if (err) return reject(err);
                  resolve({ 
                    food_item_id: item.food_item_id, 
                    quantity: item.quantity, 
                    unit_price: foodItem.price 
                  });
                }
              );
            }
          );
        })
      );
    });
    
    // Wait for all item verifications to complete
    Promise.all(itemPromises)
      .then(validatedItems => {
        // Create the order
        db.run(
          `INSERT INTO orders (merchant_id, customer_address_id, restaurant_address_id, due_time, total_price) 
           VALUES (?, ?, ?, ?, ?)`, 
          [merchant_id, customer_address_id, restaurant_address_id, due_time, totalPrice],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Failed to create order' });
            }
            
            const orderId = this.lastID;
            const orderItemPromises = [];
            
            // Add each item to the order_items table
            validatedItems.forEach(item => {
              orderItemPromises.push(
                new Promise((resolve, reject) => {
                  db.run(
                    'INSERT INTO order_items (order_id, food_item_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
                    [orderId, item.food_item_id, item.quantity, item.unit_price],
                    (err) => {
                      if (err) return reject(err);
                      resolve();
                    }
                  );
                })
              );
            });
            
            Promise.all(orderItemPromises)
              .then(() => {
                db.run('COMMIT');
                res.status(201).json({ 
                  success: true, 
                  order_id: orderId,
                  total_price: totalPrice
                });
              })
              .catch(err => {
                console.error('Error creating order items:', err);
                db.run('ROLLBACK');
                res.status(500).json({ error: 'Failed to create order items' });
              });
          }
        );
      })
      .catch(err => {
        console.error('Error validating order items:', err);
        db.run('ROLLBACK');
        res.status(400).json({ error: err.message || 'Failed to validate order items' });
      });
  });
});

// Get order details including items
app.get('/api/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const userId = req.session.user?.id;
  const userRole = req.session.user?.role;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Query to get order details
  const orderQuery = `
    SELECT o.*, 
           a_customer.name as customer_name,
           a_restaurant.name as restaurant_name
    FROM orders o
    JOIN addresses a_customer ON o.customer_address_id = a_customer.id
    JOIN addresses a_restaurant ON o.restaurant_address_id = a_restaurant.id
    WHERE o.id = ?
  `;
  
  // Query to get order items
  const itemsQuery = `
    SELECT oi.*, fi.name, fi.description
    FROM order_items oi
    JOIN food_items fi ON oi.food_item_id = fi.id
    WHERE oi.order_id = ?
  `;
  
  // Check permissions based on role
  let permissionCheck = Promise.resolve(true);
  
  if (userRole !== 'admin') {
    permissionCheck = new Promise((resolve, reject) => {
      let query = '';
      
      if (userRole === 'merchant') {
        query = 'SELECT 1 FROM orders WHERE id = ? AND merchant_id = ?';
      } else if (userRole === 'courier') {
        query = 'SELECT 1 FROM orders WHERE id = ? AND courier_id = ?';
      } else if (userRole === 'customer') {
        // For customers, we need a more complex check
        // In a full system, you'd have a link between customers and addresses
        // This is simplified - would need improvement in a real app
        query = `
          SELECT 1 FROM orders o
          JOIN addresses a ON o.customer_address_id = a.id
          WHERE o.id = ? AND a.name LIKE ?
        `;
      }
      
      if (!query) {
        resolve(false); // Unknown role - no permission
        return;
      }
      
      const params = userRole === 'customer' 
        ? [orderId, `%${req.session.user.name}%`] 
        : [orderId, userId];
      
      db.get(query, params, (err, row) => {
        if (err) {
          console.error('Error checking order permissions:', err);
          reject(err);
          return;
        }
        
        resolve(!!row); // Has permission if any row is returned
      });
    });
  }
  
  // Check permissions and get order details
  permissionCheck
    .then(hasPermission => {
      if (!hasPermission && userRole !== 'admin') {
        return res.status(403).json({ error: 'You do not have permission to view this order' });
      }
      
      // Get order details
      db.get(orderQuery, [orderId], (err, order) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to retrieve order' });
        }
        
        if (!order) {
          return res.status(404).json({ error: 'Order not found' });
        }
        
        // Get order items
        db.all(itemsQuery, [orderId], (err, items) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to retrieve order items' });
          }
          
          // Return complete order with items
          res.json({
            ...order,
            items: items
          });
        });
      });
    })
    .catch(err => {
      console.error('Error checking order permissions:', err);
      res.status(500).json({ error: 'Failed to check order permissions' });
    });
});
