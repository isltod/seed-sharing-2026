let seedsData = [];
let applicantsData = [];

document.addEventListener('DOMContentLoaded', () => {
    loadInventory();
    loadApplicants();
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}

// Inventory Logic
async function loadInventory() {
    try {
        const res = await fetch('/api/seeds');
        seedsData = await res.json();
        renderInventory();
    } catch (err) {
        console.error('Error loading inventory:', err);
    }
}

function renderInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';
    seedsData.forEach((seed, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${seed.id}</td>
            <td>
                <input type="text" value="${seed.family}" onchange="updateSeed(${index}, 'family', this.value)">
            </td>
            <td>
                <input type="text" value="${seed.name}" onchange="updateSeed(${index}, 'name', this.value)">
            </td>
            <td>
                <input type="number" value="${seed.quantity}" 
                    onchange="updateSeed(${index}, 'quantity', this.value)" style="width: 80px;">
            </td>
            <td>
                <button class="delete-btn" onclick="deleteSeed(${index})">삭제</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateSeed(index, field, value) {
    if (field === 'quantity') {
        seedsData[index][field] = parseInt(value);
    } else {
        seedsData[index][field] = value;
    }
}

function addSeed() {
    const newId = seedsData.length > 0 ? Math.max(...seedsData.map(s => s.id)) + 1 : 1;
    seedsData.push({
        id: newId,
        family: '',
        name: '',
        quantity: 0
    });
    renderInventory();
    // Scroll to bottom
    setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100);
}

function deleteSeed(index) {
    if (confirm('정말 삭제하시겠습니까?')) {
        seedsData.splice(index, 1);
        renderInventory();
    }
}

async function saveInventory() {
    try {
        const res = await fetch('/api/seeds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(seedsData)
        });
        if (res.ok) {
            alert('재고가 업데이트되었습니다.');
        } else {
            alert('업데이트 실패.');
        }
    } catch (err) {
        console.error('Error saving inventory:', err);
    }
}

async function uploadCsv() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    if (!file) return;

    if (!confirm('경고: CSV 파일을 업로드하면 기존 씨앗 재고가 모두 초기화됩니다. 계속하시겠습니까?')) {
        fileInput.value = ''; // Reset input
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);

        // Assume first row is header, or fixed structure?
        // CSV headers: 번호,과 (Family),품종명,개수(봉)
        // Let's try to parse based on position or simple replacement

        const newSeeds = [];
        let headers = null;

        rows.forEach((row, index) => {
            // Handle simple CSV splitting (ignoring commas inside quotes for now as per sample data)
            const cols = row.split(',');

            if (index === 0) {
                headers = cols; // Headers
                return;
            }

            if (cols.length < 4) return;

            // Mapping based on expected columns
            // 0: ID, 1: Family, 2: Name, 3: Quantity
            newSeeds.push({
                id: parseInt(cols[0]),
                family: cols[1],
                name: cols[2],
                quantity: parseInt(cols[3])
            });
        });

        if (newSeeds.length === 0) {
            alert('유효한 데이터가 없습니다.');
            fileInput.value = '';
            return;
        }

        try {
            // Use the "Update All" endpoint which accepts JSON
            const res = await fetch('/api/seeds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSeeds)
            });

            if (res.ok) {
                alert(`성공적으로 초기화되었습니다. (총 ${newSeeds.length}개)`);
                loadInventory();
            } else {
                const err = await res.json();
                alert('초기화 실패: ' + (err.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Error uploading seeds:', err);
            alert('서버 오류가 발생했습니다.');
        } finally {
            fileInput.value = '';
        }
    };
    reader.readAsText(file, 'UTF-8'); // Ensure UTF-8
}

// Applicant Logic
async function loadApplicants() {
    try {
        const res = await fetch('/api/applicants');
        applicantsData = await res.json();
        renderApplicants();
    } catch (err) {
        console.error('Error loading applicants:', err);
    }
}

function renderApplicants() {
    const tbody = document.getElementById('applicantTableBody');
    tbody.innerHTML = '';
    applicantsData.forEach(app => {
        const row = document.createElement('tr');

        // Map seed IDs to names
        const seedNames = app.selectedSeeds.map(id => {
            const s = seedsData.find(sd => sd.id === id);
            return s ? s.name : id;
        }).join(', ');

        const date = new Date(app.timestamp).toLocaleString('ko-KR');

        row.innerHTML = `
            <td style="font-size: 0.8em;">${date}</td>
            <td>${app.name}</td>
            <td>${app.phone}</td>
            <td><div style="max-width: 200px; overflow:hidden; text-overflow:ellipsis;">${app.address}</div></td>
            <td>${app.isMember ? '회원' : '비회원'}</td>
            <td><div style="max-width: 250px; overflow:hidden; text-overflow:ellipsis;" title="${seedNames}">${seedNames}</div></td>
        `;
        tbody.appendChild(row);
    });
}

function exportApplicants() {
    if (applicantsData.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Add BOM for Excel
    csvContent += "Time,Name,Phone,Address,IsMember,Seeds\n";

    applicantsData.forEach(app => {
        const seedNames = app.selectedSeeds.map(id => {
            const s = seedsData.find(sd => sd.id === id);
            return s ? s.name : id;
        }).join('; '); // Use semicolon separator for inner list

        const row = [
            `"${new Date(app.timestamp).toLocaleString('ko-KR')}"`,
            `"${app.name}"`,
            `"${app.phone}"`,
            `"${app.address.replace(/\n/g, ' ')}"`,
            `"${app.isMember ? '회원' : '비회원'}"`,
            `"${seedNames}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "applicants_list.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
