document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('applicationForm');
    const seedList = document.getElementById('seedList');
    const memberRadios = document.getElementsByName('isMember');
    const selectionCountSpan = document.getElementById('selectionCount');
    const phoneInput = document.getElementById('phone');

    // Address Search
    const btnSearchAddress = document.getElementById('btn-search-address');
    const postcodeInp = document.getElementById('postcode');
    const roadAddressInp = document.getElementById('roadAddress');
    const detailAddressInp = document.getElementById('detailAddress');
    const addressHiddenInp = document.getElementById('address');

    btnSearchAddress.addEventListener('click', () => {
        new daum.Postcode({
            oncomplete: function (data) {
                // 팝업에서 검색결과 항목을 클릭했을때 실행할 코드를 작성하는 부분.
                // 도로명 주소의 노출 규칙에 따라 주소를 표시한다.
                var roadAddr = data.roadAddress; // 도로명 주소 변수
                var extraRoadAddr = ''; // 참고 항목 변수

                // 법정동명이 있을 경우 추가한다. (법정리는 제외)
                // 법정동의 경우 마지막 문자가 "동/로/가"로 끝난다.
                if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
                    extraRoadAddr += data.bname;
                }
                // 건물명이 있고, 공동주택일 경우 추가한다.
                if (data.buildingName !== '' && data.apartment === 'Y') {
                    extraRoadAddr += (extraRoadAddr !== '' ? ', ' + data.buildingName : data.buildingName);
                }
                // 표시할 참고항목이 있을 경우, 괄호까지 추가한 최종 문자열을 만든다.
                if (extraRoadAddr !== '') {
                    roadAddr += ' (' + extraRoadAddr + ')';
                }

                // 우편번호와 주소 정보를 해당 필드에 넣는다.
                postcodeInp.value = data.zonecode;
                roadAddressInp.value = roadAddr;

                // 상세주소로 커서 이동
                detailAddressInp.focus();
            }
        }).open();
    });

    // Phone Number Formatting
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 3 && value.length <= 7) {
            value = value.replace(/(\d{3})(\d{1,4})/, '$1-$2');
        } else if (value.length > 7) {
            value = value.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
        }
        e.target.value = value;
    });

    let seeds = [];
    let selectedSeeds = new Set();
    let maxSeeds = 5;

    // Fetch Seeds
    fetch('/api/seeds')
        .then(res => res.json())
        .then(data => {
            seeds = data;
            renderSeeds();
        })
        .catch(err => console.error('Error fetching seeds:', err));

    // Handle Member Check
    memberRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            maxSeeds = e.target.value === 'true' ? 10 : 5;
            updateSelectionUI();
        });
    });

    function renderSeeds() {
        seedList.innerHTML = '';
        seeds.forEach(seed => {
            const div = document.createElement('div');
            div.className = `seed-item ${selectedSeeds.has(seed.id) ? 'selected' : ''} ${seed.quantity <= 0 ? 'disabled' : ''}`;

            const content = `
                <div class="seed-info">
                    <strong>${seed.name}</strong> (${seed.family})
                </div>
                <div class="seed-stock">
                    재고: ${seed.quantity}
                </div>
            `;
            div.innerHTML = content;

            if (seed.quantity > 0) {
                div.addEventListener('click', () => toggleSeed(seed.id));
            }

            seedList.appendChild(div);
        });
    }

    function toggleSeed(id) {
        if (selectedSeeds.has(id)) {
            selectedSeeds.delete(id);
        } else {
            if (selectedSeeds.size >= maxSeeds) {
                alert(`최대 ${maxSeeds}개까지만 선택할 수 있습니다.`);
                return;
            }
            selectedSeeds.add(id);
        }
        renderSeeds(); // Re-render to update styling
        updateSelectionUI();
    }

    function updateSelectionUI() {
        selectionCountSpan.textContent = `(${selectedSeeds.size}/${maxSeeds})`;

        // If switched to non-member and has too many, warn user (or auto-deselect?)
        // For now, just warn on submit or let them deselect manually.
        if (selectedSeeds.size > maxSeeds) {
            selectionCountSpan.style.color = 'red';
        } else {
            selectionCountSpan.style.color = 'inherit';
        }
    }

    // Handle Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate Name
        if (!form.name.value.trim()) {
            alert('이름을 입력해주세요.');
            form.name.focus();
            return;
        }

        // Validate Phone
        if (!form.phone.value.trim()) {
            alert('전화번호를 입력해주세요.');
            form.phone.focus();
            return;
        }

        const phoneRegex = /^010-\d{3,4}-\d{4}$/;
        if (!phoneRegex.test(form.phone.value)) {
            alert('올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)');
            form.phone.focus();
            return;
        }

        // Validate Address
        if (!postcodeInp.value || !roadAddressInp.value) {
            alert('주소 찾기를 통해 주소를 입력해주세요.');
            btnSearchAddress.focus();
            return;
        }

        if (!detailAddressInp.value.trim()) {
            alert('상세주소를 입력해주세요.');
            detailAddressInp.focus();
            return;
        }

        if (selectedSeeds.size === 0) {
            alert('씨앗을 최소 1개 이상 선택해주세요.');
            return;
        }

        if (selectedSeeds.size > maxSeeds) {
            alert(`회원 구분(회원 10개, 비회원 5개)에 맞게 씨앗 개수를 조정해주세요.`);
            return;
        }

        // Construct full address
        const fullAddress = `(${postcodeInp.value}) ${roadAddressInp.value} ${detailAddressInp.value}`;

        const formData = {
            name: form.name.value,
            phone: form.phone.value,
            address: fullAddress,
            isMember: document.querySelector('input[name="isMember"]:checked').value === 'true',
            selectedSeeds: Array.from(selectedSeeds)
        };

        try {
            const res = await fetch('/api/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await res.json();
            if (res.ok) {
                alert('신청이 완료되었습니다!');
                window.location.reload();
            } else {
                alert('신청 실패: ' + result.error);
            }
        } catch (err) {
            console.error(err);
            alert('서버 오류가 발생했습니다.');
        }
    });
});
