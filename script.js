document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const bcvRateElement = document.getElementById('bcv-rate');
    const itemNameInput = document.getElementById('item-name');
    const itemQuantityInput = document.getElementById('item-quantity');
    const itemPriceUsdInput = document.getElementById('item-price-usd'); // Nuevo input USD
    const itemPriceVesInput = document.getElementById('item-price-ves'); // Nuevo input VES
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
    let currentItems = []; // Almacena los ítems del presupuesto actual
    let partialTotalsData = []; // Almacena los objetos de totales parciales

    // --- Funciones del Modal Personalizado ---
    function showAlert(message) {
        modalMessage.textContent = message;
        customAlertModal.style.display = 'flex'; // Muestra el modal
    }

    function hideAlert() {
        customAlertModal.style.display = 'none'; // Oculta el modal
    }

    modalCloseButton.addEventListener('click', hideAlert);
    modalOkButton.addEventListener('click', hideAlert);
    window.addEventListener('click', (event) => {
        if (event.target === customAlertModal) {
            hideAlert();
        }
    });

    // --- Funciones principales ---

    /**
     * @brief Fetches the current exchange rate from a third-party API.
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
            bcvRateElement.textContent = bcvExchangeRate.toFixed(2);
        } catch (error) {
            console.error('Error al obtener la tasa de cambio del BCV:', error);
            showAlert(`No se pudo obtener la tasa de cambio del BCV. Error: ${error.message || 'Desconocido'}. 
                       Por favor, asegúrate de estar ejecutando la aplicación desde un servidor web local y 
                       verifica tu consola del navegador para más detalles.`);
            bcvExchangeRate = 36.00; // Default value in case of error
            bcvRateElement.textContent = bcvExchangeRate.toFixed(2);
        }
    }

    /**
     * @brief Updates the display of the current subtotal and recalculates all final totals.
     */
    function updateTotals() {
        // Calculate subtotal for current (non-partial) items
        let currentSubtotalUSD = currentItems.reduce((sum, item) => sum + (item.quantity * item.priceUSD), 0);
        let currentSubtotalVES = currentSubtotalUSD * bcvExchangeRate;

        currentSubtotalUsdElement.textContent = `${currentSubtotalUSD.toFixed(2)} USD`;
        currentSubtotalVesElement.textContent = `${currentSubtotalVES.toFixed(2)} VES`;

        // Calculate grand total from all partial totals
        let totalFromPartialsUSD = partialTotalsData.reduce((sum, pt) => sum + pt.totalUSD, 0);
        let totalFromPartialsVES = partialTotalsData.reduce((sum, pt) => sum + pt.totalVES, 0);

        // Grand total includes items not yet converted to a partial total
        grandTotalUsdElement.textContent = (totalFromPartialsUSD + currentSubtotalUSD).toFixed(2);
        grandTotalVesElement.textContent = (totalFromPartialsVES + currentSubtotalVES).toFixed(2);

        calculateFinalTotals();
        toggleNoItemsMessage();
        toggleNoPartialTotalsMessage();
    }

    /**
     * @brief Calculates and displays the final totals, including any percentage addition.
     */
    function calculateFinalTotals() {
        const totalUSD = parseFloat(grandTotalUsdElement.textContent) || 0;
        const totalVES = parseFloat(grandTotalVesElement.textContent) || 0;

        const percentage = parseFloat(percentageAddInput.value) || 0;
        const multiplier = 1 + (percentage / 100);

        const finalUSD = totalUSD * multiplier;
        const finalVES = totalVES * multiplier;

        finalTotalUsdElement.textContent = finalUSD.toFixed(2);
        finalTotalVesElement.textContent = finalVES.toFixed(2);
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
            // Avoid division by zero if bcvExchangeRate is 0 or not available
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

        // Limpiar inputs
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
                    Precio Unitario: ${item.priceUSD.toFixed(2)} USD (${item.priceVES.toFixed(2)} VES)
                </span>
            </div>
            <div class="item-price-converted">
                <span>Total: ${item.totalUSD.toFixed(2)} USD</span>
                <span>${item.totalVES.toFixed(2)} VES</span>
            </div>
            <div class="item-actions">
                <button class="edit-item-btn" data-id="${item.id}">Editar</button>
                <button class="delete-item-btn" data-id="${item.id}">Eliminar</button>
            </div>
        `;
        parentElement.appendChild(itemDiv);
    }

    /**
     * @brief Deletes an item from the current budget.
     * @param {number} id - The unique ID of the item to delete.
     */
    function deleteItem(id) {
        const initialLength = currentItems.length;
        currentItems = currentItems.filter(item => item.id !== id);

        if (currentItems.length < initialLength) { // Check if item was actually removed
            const itemElement = document.querySelector(`#items-list .item-row[data-id="${id}"]`);
            if (itemElement) {
                itemElement.remove();
            }
            updateTotals();
        }
    }

    /**
     * @brief Enables editing mode for a specific item in the current budget.
     * @param {number} id - The ID of the item to edit.
     * @param {HTMLElement} itemRowElement - The DOM element for the item row.
     */
    function enableItemEdit(id, itemRowElement) {
        const item = currentItems.find(i => i.id === id);
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
            <button class="save-item-btn" data-id="${item.id}">Guardar</button>
            <button class="cancel-item-btn" data-id="${item.id}">Cancelar</button>
        `;

        // Add a class to indicate editing mode
        itemRowElement.classList.add('editing');
    }

    /**
     * @brief Saves the edited values for an item.
     * @param {number} id - The ID of the item being edited.
     * @param {HTMLElement} itemRowElement - The DOM element for the item row.
     */
    function saveItemEdit(id, itemRowElement) {
        const item = currentItems.find(i => i.id === id);
        if (!item) return;

        const newName = itemRowElement.querySelector('.edit-item-name').value.trim();
        const newQuantity = parseInt(itemRowElement.querySelector('.edit-item-quantity').value);
        const newPriceUsdInput = parseFloat(itemRowElement.querySelector('.edit-item-price-usd').value);
        const newPriceVesInput = parseFloat(itemRowElement.querySelector('.edit-item-price-ves').value);

        if (!newName || isNaN(newQuantity) || newQuantity <= 0) {
            showAlert('Por favor, ingrese un nombre y cantidad válidos.');
            return;
        }

        let newPriceUSD, newPriceVES;

        // Determine which currency input was primarily used or updated
        const isUsdEntered = itemRowElement.querySelector('.edit-item-price-usd').value.trim() !== '';
        const isVesEntered = itemRowElement.querySelector('.edit-item-price-ves').value.trim() !== '';

        if (isUsdEntered && !isNaN(newPriceUsdInput) && newPriceUsdInput >= 0) {
            newPriceUSD = newPriceUsdInput;
            newPriceVES = newPriceUSD * (bcvExchangeRate || 0);
        } else if (isVesEntered && !isNaN(newPriceVesInput) && newPriceVesInput >= 0) {
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

        // Re-render the specific item row to show updated values and switch back to view mode
        renderUpdatedItem(item, itemRowElement);
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

        // Re-add event listeners to the restored buttons (delegation handles this automatically)
        // Re-render the price converted part as it was cleared during edit mode
        const item = currentItems.find(i => i.id === parseInt(itemRowElement.dataset.id));
        if (item) {
            const itemPriceConverted = itemRowElement.querySelector('.item-price-converted');
            itemPriceConverted.innerHTML = `
                <span>Total: ${item.totalUSD.toFixed(2)} USD</span>
                <span>${item.totalVES.toFixed(2)} VES</span>
            `;
        }

        itemRowElement.classList.remove('editing'); // Remove editing class
    }

    /**
     * @brief Renders an item's details after an edit, replacing the old DOM element content.
     * @param {Object} item - The updated item object.
     * @param {HTMLElement} itemRowElement - The existing DOM element to update.
     */
    function renderUpdatedItem(item, itemRowElement) {
        itemRowElement.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-details">
                    Cantidad: ${item.quantity} | 
                    Precio Unitario: ${item.priceUSD.toFixed(2)} USD (${item.priceVES.toFixed(2)} VES)
                </span>
            </div>
            <div class="item-price-converted">
                <span>Total: ${item.totalUSD.toFixed(2)} USD</span>
                <span>${item.totalVES.toFixed(2)} VES</span>
            </div>
            <div class="item-actions">
                <button class="edit-item-btn" data-id="${item.id}">Editar</button>
                <button class="delete-item-btn" data-id="${item.id}">Eliminar</button>
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
            id: Date.now(), // Unique ID for deletion
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
        partialTotalDiv.dataset.id = partialTotal.id; // Store ID for deletion

        partialTotalDiv.innerHTML = `
            <div class="partial-total-header">
                <h3>${partialTotal.name}</h3>
                <button class="delete-partial-btn" data-id="${partialTotal.id}">Eliminar</button>
            </div>
            <div class="partial-total-summary">
                <span>Total:</span>
                <span>${partialTotal.totalUSD.toFixed(2)} USD</span>
                <span>${partialTotal.totalVES.toFixed(2)} VES</span>
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
            renderItem(item, partialItemListDiv); // Render items inside the details section
        });

        partialTotalsList.appendChild(partialTotalDiv);
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
            if (partialTotalsList.contains(noPartialTotalsMessage)) {
                partialTotalsList.removeChild(noPartialTotalsMessage);
            }
            // Ensure noPartialTotalsMessage is not duplicated if already added by some other path.
            if (partialTotalsList.querySelectorAll('.partial-total-item').length === 0 && !partialTotalsList.contains(noPartialTotalsMessage)) {
                 partialTotalsList.appendChild(noPartialTotalsMessage);
            }
        }
    }

    // --- Listeners de Eventos ---

    // Listener para agregar un ítem
    addItemBtn.addEventListener('click', () => {
        const name = itemNameInput.value.trim();
        const quantity = parseInt(itemQuantityInput.value);
        
        // Get raw input values as strings
        const rawPriceUsd = itemPriceUsdInput.value.trim();
        const rawPriceVes = itemPriceVesInput.value.trim();

        // Parse to float, will be NaN if input is empty or invalid
        const priceUsd = parseFloat(rawPriceUsd);
        const priceVes = parseFloat(rawPriceVes);

        if (!name || isNaN(quantity) || quantity <= 0) {
            showAlert('Por favor, ingrese un nombre y cantidad válidos para el ítem.');
            return;
        }

        // Check if AT LEAST ONE of the price fields has a non-empty value and is a valid number
        const hasValidUsdInput = rawPriceUsd !== '' && !isNaN(priceUsd) && priceUsd >= 0;
        const hasValidVesInput = rawPriceVes !== '' && !isNaN(priceVes) && priceVes >= 0;

        if (!hasValidUsdInput && !hasValidVesInput) {
            showAlert('Por favor, ingrese un precio válido en USD o VES.');
            return;
        }

        // No need for the "both entered" alert here, as the addItem function will prioritize USD if both are present.
        // The auto-population makes it common for both to have values.

        addItem(name, quantity, hasValidUsdInput ? priceUsd : null, hasValidVesInput ? priceVes : null);
    });
    
    // Listeners para inputs de precio para conversión automática (opcional, para UX inmediata)
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


    // Listener para crear un total parcial
    createPartialTotalBtn.addEventListener('click', createPartialTotal);

    // Delegación de eventos para botones de ítem (eliminar, editar, guardar, cancelar)
    itemsList.addEventListener('click', (event) => {
        const target = event.target;
        const itemId = parseInt(target.dataset.id);
        const itemRowElement = target.closest('.item-row');

        if (isNaN(itemId) || !itemRowElement) return;

        if (target.classList.contains('delete-item-btn')) {
            deleteItem(itemId);
        } else if (target.classList.contains('edit-item-btn')) {
            enableItemEdit(itemId, itemRowElement);
        } else if (target.classList.contains('save-item-btn')) {
            saveItemEdit(itemId, itemRowElement);
        } else if (target.classList.contains('cancel-item-btn')) {
            cancelItemEdit(itemRowElement);
        }
    });

    // Delegación de eventos para botones de eliminar total parcial
    partialTotalsList.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-partial-btn')) {
            const idToDelete = parseInt(event.target.dataset.id);
            if (!isNaN(idToDelete)) {
                deletePartialTotal(idToDelete);
            }
        }
    });

    // Listener para recalcular totales cuando cambia el porcentaje
    percentageAddInput.addEventListener('input', calculateFinalTotals);

    // --- Inicialización ---
    fetchBcvRate();
    updateTotals(); // Initial update to display zeros and messages
});
