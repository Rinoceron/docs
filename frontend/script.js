const levels = [
    { level: 1, maxAmount: 50, maxTerm: 3, apr: 21 },
    { level: 2, maxAmount: 100, maxTerm: 4, apr: 20 },
    { level: 3, maxAmount: 200, maxTerm: 5, apr: 19 },
    { level: 4, maxAmount: 400, maxTerm: 6, apr: 18 },
    { level: 5, maxAmount: 800, maxTerm: 7, apr: 17 },
    { level: 6, maxAmount: 1600, maxTerm: 9, apr: 16 }
];

const customerType = document.getElementById("customerType");
const lastCompletedLevel = document.getElementById("lastCompletedLevel");
const hasActiveLoan = document.getElementById("hasActiveLoan");

const eligibleLevelName = document.getElementById("eligibleLevelName");
const eligibleAmount = document.getElementById("eligibleAmount");
const eligibilityStatus = document.getElementById("eligibilityStatus");
const eligibilityMessage = document.getElementById("eligibilityMessage");

const loanAmount = document.getElementById("loanAmount");
const loanTerm = document.getElementById("loanTerm");

const loanAmountLabel = document.getElementById("loanAmountLabel");
const loanTermLabel = document.getElementById("loanTermLabel");

const summaryLevel = document.getElementById("summaryLevel");
const summaryApr = document.getElementById("summaryApr");
const monthlyPayment = document.getElementById("monthlyPayment");
const totalPayment = document.getElementById("totalPayment");

function formatUSD(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(value);
}

function getLevelConfig(levelNumber) {
    return levels.find(item => item.level === levelNumber) || levels[0];
}

function getEligibility() {
    const type = customerType.value;
    const activeLoan = hasActiveLoan.value === "yes";
    const completed = Number(lastCompletedLevel.value);

    if (activeLoan) {
        return {
            eligible: false,
            reason: "Tienes un préstamo activo. Debes terminarlo de pagar antes de renovar.",
            levelConfig: null
        };
    }

    if (type === "new") {
        return {
            eligible: true,
            reason: "Como es tu primera vez, solo puedes aplicar al Nivel 1.",
            levelConfig: getLevelConfig(1)
        };
    }

    const nextLevel = completed + 1;

    if (completed === 0) {
        return {
            eligible: true,
            reason: "Si todavía no has completado un nivel anterior, debes empezar por Nivel 1.",
            levelConfig: getLevelConfig(1)
        };
    }

    const levelConfig = getLevelConfig(nextLevel);

    if (!levels.some(l => l.level === nextLevel)) {
        return {
            eligible: false,
            reason: "Ya no hay un siguiente nivel configurado. Habla con soporte para una renovación manual.",
            levelConfig: null
        };
    }

    return {
        eligible: true,
        reason: `Ya completaste el Nivel ${completed}. Ahora puedes aplicar al Nivel ${nextLevel}.`,
        levelConfig
    };
}

function syncFormState() {
    const type = customerType.value;
    lastCompletedLevel.disabled = type !== "returning";
}

function applyLevelToCalculator(levelConfig) {
    if (!levelConfig) {
        loanAmount.min = 50;
        loanAmount.max = 50;
        loanAmount.step = 50;
        loanAmount.value = 50;

        loanTerm.min = 2;
        loanTerm.max = 2;
        loanTerm.step = 1;
        loanTerm.value = 2;

        summaryLevel.textContent = "-";
        summaryApr.textContent = "-";
        monthlyPayment.textContent = "$0.00";
        totalPayment.textContent = "$0.00";
        loanAmountLabel.textContent = "$0";
        loanTermLabel.textContent = "0";
        return;
    }

    loanAmount.min = 50;
    loanAmount.max = levelConfig.maxAmount;
    loanAmount.step = 50;
    loanAmount.value = levelConfig.maxAmount;

    loanTerm.min = 2;
    loanTerm.max = levelConfig.maxTerm;
    loanTerm.step = 1;
    loanTerm.value = levelConfig.maxTerm;

    summaryLevel.textContent = `Nivel ${levelConfig.level}`;
    summaryApr.textContent = `${levelConfig.apr}%`;
}

function calculateLoan(levelConfig) {
    if (!levelConfig) return;

    const principal = Number(loanAmount.value);
    const months = Number(loanTerm.value);
    const monthlyRate = (levelConfig.apr / 100) / 12;

    const factor = Math.pow(1 + monthlyRate, months);
    const payment = principal * ((monthlyRate * factor) / (factor - 1));
    const total = payment * months;

    loanAmountLabel.textContent = formatUSD(principal);
    loanTermLabel.textContent = String(months);
    monthlyPayment.textContent = formatUSD(payment);
    totalPayment.textContent = formatUSD(total);
}

function refreshEligibilityAndCalculator() {
    syncFormState();

    const result = getEligibility();

    if (!result.eligible) {
        eligibleLevelName.textContent = "No disponible";
        eligibleAmount.textContent = "-";
        eligibilityStatus.textContent = "No puedes aplicar";
        eligibilityMessage.textContent = result.reason;
        applyLevelToCalculator(null);
        return;
    }

    const cfg = result.levelConfig;

    eligibleLevelName.textContent = `Nivel ${cfg.level}`;
    eligibleAmount.textContent = formatUSD(cfg.maxAmount);
    eligibilityStatus.textContent = "Puedes aplicar";
    eligibilityMessage.textContent = result.reason;

    applyLevelToCalculator(cfg);
    calculateLoan(cfg);
}

customerType.addEventListener("change", refreshEligibilityAndCalculator);
lastCompletedLevel.addEventListener("change", refreshEligibilityAndCalculator);
hasActiveLoan.addEventListener("change", refreshEligibilityAndCalculator);

loanAmount.addEventListener("input", () => {
    const result = getEligibility();
    calculateLoan(result.levelConfig);
});

loanTerm.addEventListener("input", () => {
    const result = getEligibility();
    calculateLoan(result.levelConfig);
});

refreshEligibilityAndCalculator();