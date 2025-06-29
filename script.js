document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const bcvRateElement = document.getElementById('bcv-rate');
    const itemNameInput = document.getElementById('item-name');
    const itemQuantityInput = document.getElementById('item-quantity');
    const itemPriceUsdInput = document.getElementById('item-price-usd');
    const itemPriceVesInput = document.getElementById('item-price-ves');
    const addItemBtn = document.getElementById('add-item-btn');
    const itemsList = document.getElementById('items-list');
    const noItemsMessage = document.getElementById('no-items-message');
    const currentSubtotalUsdElement = document.getElementById('current-subtotal-usd');
    const currentSubtotalVesElement = document.getElementById('current-subtotal-ves');
    const partialTotalNameInput = document.getElementById('partial-total-name');
    const createPartialTotalBtn = document.getElementById('create-partial-total-btn');
    const partialTotalsList = document.getElementById('partial-totals-list');
    const noPartialTotalsMessage = document.getElementById('no-partial-totals-message');
    const grandTotalUsdElement = document.getElementById('grand-total-usd');
    const grandTotalVesElement = document.getElementById('grand-total-ves');
    const percentageAddInput = document.getElementById('percentage-add');
    const finalTotalUsdElement = document.getElementById('final-total-usd');
    const finalTotalVesElement = document.getElementById('final-total-ves');

    // Custom Alert Modal Elements
    const customAlertModal = document.getElementById('custom-alert-modal');
    const modalMessage = document.getElementById('modal-message');
    const modalCloseButton = document.querySelector('#custom-alert-modal .close-button');
    const modalOkButton = document.querySelector('#custom-alert-modal .modal-ok-button');

    // --- Variables de estado ---
    let bcvExchangeRate = 0;
    let currentItems = []; // Stores items in the current budget (before becoming a partial total)
    let partialTotalsData = []; // Stores objects for all created partial totals

    // --- Number Formatting Utility ---
    const formatNumber = (num) => {
        // Formats a number to Venezuelan locale (e.g., 1.500,00)
        return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // --- Custom Alert Modal Functions ---
    function showAlert(message) {
        modalMessage.textContent = message;
        customAlertModal.style.display = 'flex'; // Show modal
    }

    function hideAlert() {
        customAlertModal.style.display = 'none'; // Hide modal
    }

    modalCloseButton.addEventListener('click', hideAlert);
    modalOkButton.addEventListener('click', hideAlert);
    window.addEventListener('click', (event) => {
        if (event.target === customAlertModal) {
            hideAlert();
        }
    });

    // --- Core Application Functions ---

    /**
     * @brief Fetches the current exchange rate from a third-party API.
     * Displays an error message on the UI if fetching fails, but does not use a modal.
     * @returns {Promise<void>} A promise that resolves when the rate is fetched or an error occurs.
     */
    async function fetchBcvRate() {
        try {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText || 'Unknown error'}`);
            }
            const data = await response.json();
            bcvExchangeRate = data.rates.VES;
            if (isNaN(bcvExchangeRate) || bcvExchangeRate <= 0) {
                 throw new Error('La tasa de cambio obtenida no es válida.');
            }
            bcvRateElement.textContent = formatNumber(bcvExchangeRate); // Format rate
        } catch (error) {
            console.error('Error al obtener la tasa de cambio del BCV:', error);
            bcvRateElement.textContent = `Error: ${formatNumber(bcvExchangeRate)}`;
            
            // Set a default if fetching fails or rate is invalid
            if (bcvExchangeRate === 0 || isNaN(bcvExchangeRate) || bcvExchangeRate <= 0) {
                 bcvExchangeRate = 36.00; // Fallback default value
                 bcvRateElement.textContent = `${formatNumber(bcvExchangeRate)} (por defecto)`;
            }
            console.warn('Usando una tasa de cambio predeterminada debido a un error al cargar la API.');
        }
    }

    /**
     * @brief Recalculates and updates the display of current subtotal, grand totals, and final totals.
     */
    function updateTotals() {
        // Calculate subtotal for current (non-partial) items
        let currentSubtotalUSD = currentItems.reduce((sum, item) => sum + (item.quantity * item.priceUSD), 0);
        let currentSubtotalVES = currentSubtotalUSD * bcvExchangeRate;

        currentSubtotalUsdElement.textContent = `${formatNumber(currentSubtotalUSD)} USD`;
        currentSubtotalVesElement.textContent = `${formatNumber(currentSubtotalVES)} VES`;

        // Calculate grand total from all partial totals
        let totalFromPartialsUSD = partialTotalsData.reduce((sum, pt) => sum + pt.totalUSD, 0);
        let totalFromPartialsVES = partialTotalsData.reduce((sum, pt) => sum + pt.totalVES, 0);

        // Grand total includes items not yet converted to a partial total
        const grandTotalCalculatedUSD = totalFromPartialsUSD + currentSubtotalUSD;
        const grandTotalCalculatedVES = totalFromPartialsVES + currentSubtotalVES;

        grandTotalUsdElement.textContent = formatNumber(grandTotalCalculatedUSD);
        grandTotalVesElement.textContent = formatNumber(grandTotalCalculatedVES);

        calculateFinalTotals();
        toggleNoItemsMessage();
        toggleNoPartialTotalsMessage();
    }

    /**
     * @brief Calculates and displays the final totals, including any percentage addition.
     */
    function calculateFinalTotals() {
        const totalUSD = parseFloat(grandTotalUsdElement.textContent.replace(/\./g, '').replace(',', '.')) || 0; // Parse formatted number
        const totalVES = parseFloat(grandTotalVesElement.textContent.replace(/\./g, '').replace(',', '.')) || 0; // Parse formatted number

        const percentage = parseFloat(percentageAddInput.value) || 0;
        const multiplier = 1 + (percentage / 100);

        const finalUSD = totalUSD * multiplier;
        const finalVES = totalVES * multiplier;

        finalTotalUsdElement.textContent = formatNumber(finalUSD);
        finalTotalVesElement.textContent = formatNumber(finalVES);
    }

    /**
     * @brief Adds a new item to the current budget list.
     * Handles conversion between USD and VES based on user input.
     * @param {string} name - Name of the item.
     * @param {number} quantity - Quantity of the item.
     * @param {number} priceInputUSD - Price entered in USD, can be null.
     * @param {number} priceInputVES - Price entered in VES, can be null.
     */
    function addItem(name, quantity, priceInputUSD, priceInputVES) {
        let priceUSD, priceVES;

        if (priceInputUSD !== null && !isNaN(priceInputUSD) && priceInputUSD >= 0) {
            priceUSD = priceInputUSD;
            priceVES = priceUSD * (bcvExchangeRate || 0);
        } else if (priceInputVES !== null && !isNaN(priceInputVES) && priceInputVES >= 0) {
            priceVES = priceInputVES;
            priceUSD = (bcvExchangeRate > 0) ? (priceVES / bcvExchangeRate) : 0; 
        } else {
            showAlert('Por favor, ingrese un precio válido en USD o VES.');
            return;
        }

        const itemTotalUSD = quantity * priceUSD;
        const itemTotalVES = quantity * priceVES;

        const newItem = {
            id: Date.now(), // Unique ID for management
            name,
            quantity,
            priceUSD,
            priceVES, // Store both original prices
            totalUSD: itemTotalUSD,
            totalVES: itemTotalVES
        };

        currentItems.push(newItem);
        renderItem(newItem, itemsList);
        updateTotals();

        // Clear inputs
        itemNameInput.value = '';
        itemQuantityInput.value = '';
        itemPriceUsdInput.value = '';
        itemPriceVesInput.value = '';
    }

    /**
     * @brief Renders a single item row in a given list element.
     * Includes edit and delete buttons.
     * @param {Object} item - The item object to render.
     * @param {HTMLElement} parentElement - The DOM element where the item row should be appended.
     */
    function renderItem(item, parentElement) {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('item-row');
        itemDiv.dataset.id = item.id; // Associate DOM element with item ID

        itemDiv.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-details">
                    Cantidad: ${item.quantity} | 
                    Precio Unitario: ${formatNumber(item.priceUSD)} USD (${formatNumber(item.priceVES)} VES)
                </span>
            </div>
            <div class="item-price-converted">
                <span>Total: ${formatNumber(item.totalUSD)} USD</span>
                <span>${formatNumber(item.totalVES)} VES</span>
            </div>
            <div class="item-actions">
                <button class="edit-item-btn" data-id="${item.id}">Editar</button>
                <button class="delete-item-btn" data-id="${item.id}">🗑️</button>
            </div>
        `;
        parentElement.appendChild(itemDiv);
    }

    /**
     * @brief Deletes an item from either currentItems or a partial total's items.
     * @param {number} itemId - The unique ID of the item to delete.
     * @param {number|null} [partialTotalId=null] - The ID of the parent partial total, if applicable.
     */
    function deleteItem(itemId, partialTotalId = null) {
        if (partialTotalId === null) {
            // Deleting from currentItems
            const initialLength = currentItems.length;
            currentItems = currentItems.filter(item => item.id !== itemId);
            if (currentItems.length < initialLength) {
                const itemElement = document.querySelector(`#items-list .item-row[data-id="${itemId}"]`);
                if (itemElement) {
                    itemElement.remove();
                }
                updateTotals();
            }
        } else {
            // Deleting from a partial total's items
            const partialTotal = partialTotalsData.find(pt => pt.id === partialTotalId);
            if (partialTotal) {
                const initialLength = partialTotal.items.length;
                partialTotal.items = partialTotal.items.filter(item => item.id !== itemId);
                
                // Recalculate partial total's sum
                partialTotal.totalUSD = partialTotal.items.reduce((sum, item) => sum + item.totalUSD, 0);
                partialTotal.totalVES = partialTotal.totalUSD * bcvExchangeRate;

                if (partialTotal.items.length < initialLength) {
                    // Re-render the specific partial total to reflect the change
                    renderUpdatedPartialTotal(partialTotal);
                    updateTotals();
                }
            }
        }
    }

    /**
     * @brief Enables editing mode for a specific item.
     * @param {number} itemId - The ID of the item to edit.
     * @param {HTMLElement} itemRowElement - The DOM element for the item row.
     * @param {number|null} [partialTotalId=null] - The ID of the parent partial total, if applicable.
     */
    function enableItemEdit(itemId, itemRowElement, partialTotalId = null) {
        let item;
        if (partialTotalId === null) {
            item = currentItems.find(i => i.id === itemId);
        } else {
            const partialTotal = partialTotalsData.find(pt => pt.id === partialTotalId);
            item = partialTotal ? partialTotal.items.find(i => i.id === itemId) : null;
        }

        if (!item) return;

        const itemInfo = itemRowElement.querySelector('.item-info');
        const itemPriceConverted = itemRowElement.querySelector('.item-price-converted');
        const itemActions = itemRowElement.querySelector('.item-actions');

        // Store original content to restore on cancel
        itemRowElement.dataset.originalInfo = itemInfo.innerHTML;
        itemRowElement.dataset.originalActions = itemActions.innerHTML;

        itemInfo.innerHTML = `
            <input type="text" class="edit-item-name" value="${item.name}">
            <input type="number" class="edit-item-quantity" value="${item.quantity}" min="1">
            <div class="edit-currency-inputs">
                <input type="number" class="edit-item-price-usd" value="${item.priceUSD.toFixed(2)}" step="0.01" min="0" placeholder="USD">
                <input type="number" class="edit-item-price-ves" value="${item.priceVES.toFixed(2)}" step="0.01" min="0" placeholder="VES">
            </div>
        `;

        itemPriceConverted.innerHTML = ''; // Clear total display during edit

        itemActions.innerHTML = `
            <button class="save-item-btn" data-id="${itemId}" data-partial-total-id="${partialTotalId}">Guardar</button>
            <button class="cancel-item-btn" data-id="${itemId}" data-partial-total-id="${partialTotalId}">Cancelar</button>
        `;

        // Add a class to indicate editing mode
        itemRowElement.classList.add('editing');
    }

    /**
     * @brief Saves the edited values for an item.
     * @param {number} itemId - The ID of the item being edited.
     * @param {HTMLElement} itemRowElement - The DOM element for the item row.
     * @param {number|null} [partialTotalId=null] - The ID of the parent partial total, if applicable.
     */
    function saveItemEdit(itemId, itemRowElement, partialTotalId = null) {
        let item;
        if (partialTotalId === null) {
            item = currentItems.find(i => i.id === itemId);
        } else {
            const partialTotal = partialTotalsData.find(pt => pt.id === partialTotalId);
            item = partialTotal ? partialTotal.items.find(i => i.id === itemId) : null;
        }
        if (!item) return;

        const newName = itemRowElement.querySelector('.edit-item-name').value.trim();
        const newQuantity = parseInt(itemRowElement.querySelector('.edit-item-quantity').value);
        
        const rawNewPriceUsd = itemRowElement.querySelector('.edit-item-price-usd').value.trim();
        const rawNewPriceVes = itemRowElement.querySelector('.edit-item-price-ves').value.trim();
        const newPriceUsdInput = parseFloat(rawNewPriceUsd);
        const newPriceVesInput = parseFloat(rawNewPriceVes);

        if (!newName || isNaN(newQuantity) || newQuantity <= 0) {
            showAlert('Por favor, ingrese un nombre y cantidad válidos.');
            return;
        }

        const hasValidUsdInput = rawNewPriceUsd !== '' && !isNaN(newPriceUsdInput) && newPriceUsdInput >= 0;
        const hasValidVesInput = rawNewPriceVes !== '' && !isNaN(newPriceVesInput) && newPriceVesInput >= 0;

        let newPriceUSD, newPriceVES;

        if (hasValidUsdInput) {
            newPriceUSD = newPriceUsdInput;
            newPriceVES = newPriceUSD * (bcvExchangeRate || 0);
        } else if (hasValidVesInput) {
            newPriceVES = newPriceVesInput;
            newPriceUSD = (bcvExchangeRate > 0) ? (newPriceVES / bcvExchangeRate) : 0;
        } else {
            showAlert('Por favor, ingrese un precio válido en USD o VES.');
            return;
        }

        // Update the item object
        item.name = newName;
        item.quantity = newQuantity;
        item.priceUSD = newPriceUSD;
        item.priceVES = newPriceVES;
        item.totalUSD = newQuantity * newPriceUSD;
        item.totalVES = newQuantity * newPriceVES;

        if (partialTotalId === null) {
            // Re-render the specific item row to show updated values and switch back to view mode
            renderUpdatedItem(item, itemRowElement);
        } else {
            // Recalculate parent partial total's sum and re-render the partial total
            const partialTotal = partialTotalsData.find(pt => pt.id === partialTotalId);
            if (partialTotal) {
                partialTotal.totalUSD = partialTotal.items.reduce((sum, i) => sum + i.totalUSD, 0);
                partialTotal.totalVES = partialTotal.totalUSD * bcvExchangeRate;
                renderUpdatedPartialTotal(partialTotal); // Re-render the entire partial total
            }
        }
        updateTotals();
    }

    /**
     * @brief Cancels editing mode for an item and restores its original state.
     * @param {HTMLElement} itemRowElement - The DOM element for the item row.
     */
    function cancelItemEdit(itemRowElement) {
        // Restore original HTML
        const itemInfo = itemRowElement.querySelector('.item-info');
        const itemActions = itemRowElement.querySelector('.item-actions');

        if (itemRowElement.dataset.originalInfo) {
            itemInfo.innerHTML = itemRowElement.dataset.originalInfo;
        }
        if (itemRowElement.dataset.originalActions) {
            itemActions.innerHTML = itemRowElement.dataset.originalActions;
        }

        // Re-render the price converted part as it was cleared during edit mode
        const itemId = parseInt(itemRowElement.dataset.id);
        const partialTotalId = itemRowElement.dataset.partialTotalId ? parseInt(itemRowElement.dataset.partialTotalId) : null;
        let item;
        if (partialTotalId === null) {
            item = currentItems.find(i => i.id === itemId);
        } else {
            const partialTotal = partialTotalsData.find(pt => pt.id === partialTotalId);
            item = partialTotal ? partialTotal.items.find(i => i.id === itemId) : null;
        }

        if (item) {
            const itemPriceConverted = itemRowElement.querySelector('.item-price-converted');
            if (itemPriceConverted) { // Ensure the element exists before trying to set innerHTML
                itemPriceConverted.innerHTML = `
                    <span>Total: ${formatNumber(item.totalUSD)} USD</span>
                    <span>${formatNumber(item.totalVES)} VES</span>
                `;
            }
        }

        itemRowElement.classList.remove('editing'); // Remove editing class
    }

    /**
     * @brief Renders an item's details after an edit, replacing the old DOM element content.
     * This is specifically for items in the current budget list.
     * @param {Object} item - The updated item object.
     * @param {HTMLElement} itemRowElement - The existing DOM element to update.
     */
    function renderUpdatedItem(item, itemRowElement) {
        itemRowElement.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-details">
                    Cantidad: ${item.quantity} | 
                    Precio Unitario: ${formatNumber(item.priceUSD)} USD (${formatNumber(item.priceVES)} VES)
                </span>
            </div>
            <div class="item-price-converted">
                <span>Total: ${formatNumber(item.totalUSD)} USD</span>
                <span>${formatNumber(item.totalVES)} VES</span>
            </div>
            <div class="item-actions">
                <button class="edit-item-btn" data-id="${item.id}">Editar</button>
                <button class="delete-item-btn" data-id="${item.id}">🗑️</button>
            </div>
        `;
        itemRowElement.classList.remove('editing'); // Ensure editing class is removed
    }


    /**
     * @brief Creates a new partial total from the current items.
     */
    function createPartialTotal() {
        if (currentItems.length === 0) {
            showAlert('No hay ítems en el presupuesto actual para crear un total parcial.');
            return;
        }

        const partialName = partialTotalNameInput.value.trim() || `Total Parcial ${partialTotalsData.length + 1}`;
        const partialSumUSD = currentItems.reduce((sum, item) => sum + item.totalUSD, 0);
        const partialSumVES = currentItems.reduce((sum, item) => sum + item.totalVES, 0);

        const newPartialTotal = {
            id: Date.now(), // Unique ID for deletion and editing
            name: partialName,
            totalUSD: partialSumUSD,
            totalVES: partialSumVES,
            items: [...currentItems] // Store a copy of current items
        };

        partialTotalsData.push(newPartialTotal);
        renderPartialTotal(newPartialTotal);

        currentItems = []; // Clear current items after creating the partial total
        itemsList.innerHTML = ''; // Clear current items in the UI
        partialTotalNameInput.value = ''; // Clear partial total name input
        updateTotals(); // Recalculate all totals
    }

    /**
     * @brief Renders a single partial total row in the partial totals list.
     * @param {Object} partialTotal - The partial total object to render.
     */
    function renderPartialTotal(partialTotal) {
        const partialTotalDiv = document.createElement('div');
        partialTotalDiv.classList.add('partial-total-item');
        partialTotalDiv.dataset.id = partialTotal.id; // Store ID for deletion/editing

        partialTotalDiv.innerHTML = `
            <div class="partial-total-header">
                <h3 class="partial-name">${partialTotal.name}</h3>
                <button class="edit-partial-name-btn" data-id="${partialTotal.id}">Editar Nombre</button>
                <button class="delete-partial-btn" data-id="${partialTotal.id}">🗑️</button>
            </div>
            <div class="partial-total-summary">
                <span>Total:</span>
                <span>${formatNumber(partialTotal.totalUSD)} USD</span>
                <span>${formatNumber(partialTotal.totalVES)} VES</span>
            </div>
            <details>
                <summary>Ver Ítems (${partialTotal.items.length})</summary>
                <div class="partial-item-list">
                    <!-- Items will be rendered here -->
                </div>
            </details>
        `;

        const partialItemListDiv = partialTotalDiv.querySelector('.partial-item-list');
        partialTotal.items.forEach(item => {
            // When rendering items inside a partial total, we need to pass the partialTotalId
            // so the delete/edit functions know which parent total to update.
            renderItemForPartialTotal(item, partialItemListDiv, partialTotal.id); 
        });

        partialTotalsList.appendChild(partialTotalDiv);
    }

    /**
     * @brief Renders an item row specifically for use within a partial total's item list.
     * These items will have data attributes linking them to their parent partial total.
     * @param {Object} item - The item object to render.
     * @param {HTMLElement} parentElement - The DOM element where the item row should be appended.
     * @param {number} partialTotalId - The ID of the parent partial total.
     */
    function renderItemForPartialTotal(item, parentElement, partialTotalId) {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('item-row');
        itemDiv.dataset.id = item.id;
        itemDiv.dataset.partialTotalId = partialTotalId; // Crucial for delegation

        itemDiv.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-details">
                    Cantidad: ${item.quantity} | 
                    Precio Unitario: ${formatNumber(item.priceUSD)} USD (${formatNumber(item.priceVES)} VES)
                </span>
            </div>
            <div class="item-price-converted">
                <span>Total: ${formatNumber(item.totalUSD)} USD</span>
                <span>${formatNumber(item.totalVES)} VES</span>
            </div>
            <div class="item-actions">
                <button class="edit-item-btn" data-id="${item.id}" data-partial-total-id="${partialTotalId}">Editar</button>
                <button class="delete-item-btn" data-id="${item.id}" data-partial-total-id="${partialTotalId}">🗑️</button>
            </div>
        `;
        parentElement.appendChild(itemDiv);
    }

    /**
     * @brief Removes an old partial total DOM element and renders the updated one.
     * @param {Object} updatedPartialTotal - The partial total object with updated data.
     */
    function renderUpdatedPartialTotal(updatedPartialTotal) {
        const oldElement = document.querySelector(`.partial-total-item[data-id="${updatedPartialTotal.id}"]`);
        if (oldElement) {
            oldElement.remove(); // Remove the old DOM element
        }
        renderPartialTotal(updatedPartialTotal); // Render the new one
    }

    /**
     * @brief Deletes a partial total by its ID.
     * @param {number} id - The unique ID of the partial total to delete.
     */
    function deletePartialTotal(id) {
        const index = partialTotalsData.findIndex(pt => pt.id === id);

        if (index !== -1) {
            partialTotalsData.splice(index, 1);
            const elementToRemove = document.querySelector(`.partial-total-item[data-id="${id}"]`);
            if (elementToRemove) {
                elementToRemove.remove();
            }
            updateTotals(); // Recalculate totals after deletion
        }
    }

    /**
     * @brief Enables editing mode for a partial total's name.
     * @param {number} partialTotalId - The ID of the partial total whose name is to be edited.
     * @param {HTMLElement} partialTotalElement - The DOM element of the partial total.
     */
    function enablePartialTotalNameEdit(partialTotalId, partialTotalElement) {
        const partialTotal = partialTotalsData.find(pt => pt.id === partialTotalId);
        if (!partialTotal) return;

        const partialTotalHeader = partialTotalElement.querySelector('.partial-total-header');
        
        // Store current content to restore on cancel
        partialTotalElement.dataset.originalPartialNameHtml = partialTotalHeader.innerHTML;

        partialTotalHeader.innerHTML = `
            <div class="partial-name-edit-group">
                <input type="text" class="edit-partial-name-input" value="${partialTotal.name}">
                <button class="save-partial-name-btn" data-id="${partialTotal.id}">Guardar</button>
                <button class="cancel-partial-name-btn" data-id="${partialTotal.id}">Cancelar</button>
            </div>
            <button class="delete-partial-btn" data-id="${partialTotal.id}">🗑️</button>
        `;
    }

    /**
     * @brief Saves the new name for a partial total.
     * @param {number} partialTotalId - The ID of the partial total.
     * @param {HTMLElement} partialTotalElement - The DOM element of the partial total.
     */
    function savePartialTotalName(partialTotalId, partialTotalElement) {
        const partialTotal = partialTotalsData.find(pt => pt.id === partialTotalId);
        if (!partialTotal) return;

        const newNameInput = partialTotalElement.querySelector('.edit-partial-name-input');
        const newName = newNameInput.value.trim();

        if (newName === '') {
            showAlert('El nombre del total parcial no puede estar vacío.');
            return;
        }

        partialTotal.name = newName;
        renderUpdatedPartialTotal(partialTotal); // Re-render to update the display
        updateTotals();
    }

    /**
     * @brief Cancels editing the name for a partial total and restores its original state.
     * @param {HTMLElement} partialTotalElement - The DOM element of the partial total.
     */
    function cancelPartialTotalNameEdit(partialTotalElement) {
        const originalNameHtml = partialTotalElement.dataset.originalPartialNameHtml;
        const partialTotalHeader = partialTotalElement.querySelector('.partial-total-header');
        if (originalNameHtml && partialTotalHeader) {
            partialTotalHeader.innerHTML = originalNameHtml;
        }
    }


    /**
     * @brief Toggles the "no items" message visibility.
     */
    function toggleNoItemsMessage() {
        if (currentItems.length === 0) {
            if (!itemsList.contains(noItemsMessage)) {
                itemsList.appendChild(noItemsMessage);
            }
        } else {
            if (itemsList.contains(noItemsMessage)) {
                itemsList.removeChild(noItemsMessage);
            }
        }
    }

    /**
     * @brief Toggles the "no partial totals" message visibility.
     */
    function toggleNoPartialTotalsMessage() {
        if (partialTotalsData.length === 0) {
            if (!partialTotalsList.contains(noPartialTotalsMessage)) {
                partialTotalsList.appendChild(noPartialTotalsMessage);
            }
        } else {
            // Remove if it exists and there are partial totals
            if (partialTotalsList.contains(noPartialTotalsMessage)) {
                partialTotalsList.removeChild(noPartialTotalsMessage);
            }
        }
    }

    // --- Event Listeners ---

    // Listener for adding a new item
    addItemBtn.addEventListener('click', () => {
        const name = itemNameInput.value.trim();
        const quantity = parseInt(itemQuantityInput.value);
        
        const rawPriceUsd = itemPriceUsdInput.value.trim();
        const rawPriceVes = itemPriceVesInput.value.trim();

        const priceUsd = parseFloat(rawPriceUsd);
        const priceVes = parseFloat(rawPriceVes);

        if (!name || isNaN(quantity) || quantity <= 0) {
            showAlert('Por favor, ingrese un nombre y cantidad válidos para el ítem.');
            return;
        }

        const hasValidUsdInput = rawPriceUsd !== '' && !isNaN(priceUsd) && priceUsd >= 0;
        const hasValidVesInput = rawPriceVes !== '' && !isNaN(priceVes) && priceVes >= 0;

        if (!hasValidUsdInput && !hasValidVesInput) {
            showAlert('Por favor, ingrese un precio válido en USD o VES.');
            return;
        }

        addItem(name, quantity, hasValidUsdInput ? priceUsd : null, hasValidVesInput ? priceVes : null);
    });
    
    // Listeners for price inputs for automatic conversion (for immediate UX)
    itemPriceUsdInput.addEventListener('input', () => {
        const usdValue = parseFloat(itemPriceUsdInput.value);
        if (!isNaN(usdValue) && bcvExchangeRate > 0) {
            itemPriceVesInput.value = (usdValue * bcvExchangeRate).toFixed(2);
        } else if (itemPriceUsdInput.value.trim() === '') {
            itemPriceVesInput.value = '';
        }
    });

    itemPriceVesInput.addEventListener('input', () => {
        const vesValue = parseFloat(itemPriceVesInput.value);
        if (!isNaN(vesValue) && bcvExchangeRate > 0) {
            itemPriceUsdInput.value = (vesValue / bcvExchangeRate).toFixed(2);
        } else if (itemPriceVesInput.value.trim() === '') {
            itemPriceUsdInput.value = '';
        }
    });


    // Listener for creating a partial total
    createPartialTotalBtn.addEventListener('click', createPartialTotal);

    // Event delegation for item action buttons within the CURRENT items list
    itemsList.addEventListener('click', (event) => {
        const target = event.target;
        const itemId = parseInt(target.dataset.id);
        const itemRowElement = target.closest('.item-row');

        if (isNaN(itemId) || !itemRowElement) return;

        if (target.classList.contains('delete-item-btn')) {
            deleteItem(itemId); // No partialTotalId, so it operates on currentItems
        } else if (target.classList.contains('edit-item-btn')) {
            enableItemEdit(itemId, itemRowElement); // No partialTotalId
        } else if (target.classList.contains('save-item-btn')) {
            saveItemEdit(itemId, itemRowElement); // No partialTotalId
        } else if (target.classList.contains('cancel-item-btn')) {
            cancelItemEdit(itemRowElement);
        }
    });

    // Event delegation for ALL partial total related buttons (delete partial, edit item inside partial, etc.)
    partialTotalsList.addEventListener('click', (event) => {
        const target = event.target;
        const partialTotalId = target.dataset.id ? parseInt(target.dataset.id) : null;
        const itemRowElement = target.closest('.item-row'); // Check if click is on an item row inside a partial total

        if (target.classList.contains('delete-partial-btn')) {
            if (!isNaN(partialTotalId)) {
                deletePartialTotal(partialTotalId);
            }
        } else if (target.classList.contains('edit-partial-name-btn')) {
             if (!isNaN(partialTotalId)) {
                const partialTotalElement = target.closest('.partial-total-item');
                enablePartialTotalNameEdit(partialTotalId, partialTotalElement);
            }
        } else if (target.classList.contains('save-partial-name-btn')) {
            if (!isNaN(partialTotalId)) {
                const partialTotalElement = target.closest('.partial-total-item');
                savePartialTotalName(partialTotalId, partialTotalElement);
            }
        } else if (target.classList.contains('cancel-partial-name-btn')) {
            const partialTotalElement = target.closest('.partial-total-item');
            cancelPartialTotalNameEdit(partialTotalElement);
        }
        // Handle item actions within partial totals (delegated through partialTotalsList)
        else if (itemRowElement && itemRowElement.dataset.partialTotalId) {
            const itemId = parseInt(itemRowElement.dataset.id);
            const parentPartialTotalId = parseInt(itemRowElement.dataset.partialTotalId);

            if (target.classList.contains('delete-item-btn')) {
                deleteItem(itemId, parentPartialTotalId);
            } else if (target.classList.contains('edit-item-btn')) {
                enableItemEdit(itemId, itemRowElement, parentPartialTotalId);
            } else if (target.classList.contains('save-item-btn')) {
                saveItemEdit(itemId, itemRowElement, parentPartialTotalId);
            } else if (target.classList.contains('cancel-item-btn')) {
                cancelItemEdit(itemRowElement);
            }
        }
    });


    // Listener to recalculate totals when percentage changes
    percentageAddInput.addEventListener('input', calculateFinalTotals);

    // --- Initialization ---
    fetchBcvRate();
    updateTotals(); // Initial update to display zeros and messages
});