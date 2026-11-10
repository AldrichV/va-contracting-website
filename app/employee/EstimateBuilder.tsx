"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type LineItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

type DocumentType = "Estimate" | "Invoice";
type HistoryFilter = "All" | DocumentType;

const initialItems: LineItem[] = [
  {
    description: "Site preparation and protection",
    quantity: 1,
    unit: "lot",
    unitPrice: 450,
  },
  {
    description: "Labour and installation",
    quantity: 24,
    unit: "hr",
    unitPrice: 85,
  },
  {
    description: "Materials allowance",
    quantity: 1,
    unit: "allowance",
    unitPrice: 1800,
  },
];

const defaultEmailMessage =
  "Thank you for considering VA Contracting. Please review the details below and let us know if you have any questions.";

const defaultNotes =
  "Scope and pricing are based on visible site conditions. Final pricing may change if hidden conditions, client-requested changes, or permit requirements affect the work.";

const defaultChequingAccountNumber = "Add chequing account number";
const defaultHstNumber = "709163471 RT0001";

type EstimateBuilderProps = {
  lockedDocumentType?: DocumentType;
  employeeEmail: string;
  employeeName: string;
};

type JobsiteOption = {
  clientName: string;
  id: number;
  name: string;
};

type SavedEstimate = {
  clientName: string;
  createdAt: string;
  estimateNumber: string;
  id: number;
  jobsiteId: number | null;
  jobsiteName: string;
  payload: unknown;
  projectAddress: string;
  projectType: string;
  status: string;
  total: number;
};

type SavedEstimatePayload = {
  clientEmail?: string;
  chequingAccountNumber?: string;
  deposit?: number;
  amountPaid?: number;
  documentType?: DocumentType;
  dueDate?: string;
  emailMessage?: string;
  datePrepared?: string;
  estimateNumber?: string;
  hstNumber?: string;
  items?: LineItem[];
  markup?: number;
  notes?: string;
  paymentTerms?: string;
  projectAddress?: string;
  projectType?: string;
  status?: string;
  taxRate?: number;
  validFor?: number;
};

type EmailSetupStatus = {
  bccConfigured?: boolean;
  configured?: boolean;
  error?: string;
  fromEmail?: string;
};

type DocumentSnapshotFields = {
  amountPaid: number;
  chequingAccountNumber: string;
  clientEmail: string;
  clientName: string;
  datePrepared: string;
  deposit: number;
  documentType: DocumentType;
  dueDate: string;
  emailMessage: string;
  estimateNumber: string;
  hstNumber: string;
  items: LineItem[];
  jobsiteId: string;
  markup: number;
  notes: string;
  paymentTerms: string;
  projectAddress: string;
  projectType: string;
  status: string;
  taxRate: number;
  validFor: number;
};

export function EstimateBuilder({
  employeeEmail,
  employeeName,
  lockedDocumentType,
}: EstimateBuilderProps) {
  const initialDocumentType = lockedDocumentType ?? "Estimate";
  const isLockedWorkspace = Boolean(lockedDocumentType);
  const isInvoiceWorkspace = lockedDocumentType === "Invoice";
  const workspaceNoun = isInvoiceWorkspace ? "invoice" : "estimate";
  const [clientName, setClientName] = useState("Client Name");
  const [clientEmail, setClientEmail] = useState("");
  const [documentType, setDocumentType] =
    useState<DocumentType>(initialDocumentType);
  const [jobsites, setJobsites] = useState<JobsiteOption[]>([]);
  const [jobsiteId, setJobsiteId] = useState("");
  const [projectAddress, setProjectAddress] = useState("Project address");
  const [projectType, setProjectType] = useState("Kitchen Renovation");
  const [status, setStatus] = useState("Draft");
  const [saveMessage, setSaveMessage] = useState("");
  const [emailMessage, setEmailMessage] = useState(defaultEmailMessage);
  const [emailStatus, setEmailStatus] = useState("");
  const [emailSetupStatus, setEmailSetupStatus] =
    useState<EmailSetupStatus | null>(null);
  const [datePrepared, setDatePrepared] = useState(() => todayIsoDate());
  const [estimateNumber, setEstimateNumber] = useState(() =>
    buildNextDocumentNumber([], todayIsoDate(), initialDocumentType),
  );
  const [estimateNumberTouched, setEstimateNumberTouched] = useState(false);
  const [validFor, setValidFor] = useState(14);
  const [markup, setMarkup] = useState(10);
  const [taxRate, setTaxRate] = useState(13);
  const [deposit, setDeposit] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState("Due upon receipt");
  const [chequingAccountNumber, setChequingAccountNumber] = useState(
    defaultChequingAccountNumber,
  );
  const [hstNumber, setHstNumber] = useState(defaultHstNumber);
  const [dueDate, setDueDate] = useState(() => addDaysIso(todayIsoDate(), 14));
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState(defaultNotes);
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>([]);
  const [activeEstimateId, setActiveEstimateId] = useState<number | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>(
    lockedDocumentType ?? "All",
  );
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  const loadEstimateWorkspace = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [jobsiteResponse, estimateResponse] = await Promise.all([
        fetch("/api/jobsites"),
        fetch("/api/estimates"),
      ]);
      const jobsiteData = (await jobsiteResponse.json()) as {
        jobsites?: JobsiteOption[];
      };
      const estimateData = (await estimateResponse.json()) as {
        error?: string;
        estimates?: SavedEstimate[];
      };

      if (!jobsiteResponse.ok) throw new Error("Unable to load jobsites.");
      if (!estimateResponse.ok) {
        throw new Error(estimateData.error ?? "Unable to load saved estimates.");
      }

      setJobsites(jobsiteData.jobsites ?? []);
      setSavedEstimates(estimateData.estimates ?? []);
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : "Unable to load saved estimates.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadEstimateWorkspace);
  }, [loadEstimateWorkspace]);

  useEffect(() => {
    let active = true;
    fetch("/api/estimate-email")
      .then(async (response) => {
        const data = (await response.json()) as EmailSetupStatus;
        if (active) setEmailSetupStatus({ ...data, configured: response.ok });
      })
      .catch(() => {
        if (active) {
          setEmailSetupStatus({
            configured: false,
            error: "Direct email setup could not be checked.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!estimateNumberTouched) {
      const nextNumber = buildNextDocumentNumber(
        savedEstimates,
        datePrepared,
        documentType,
      );
      queueMicrotask(() => setEstimateNumber(nextNumber));
    }
  }, [datePrepared, documentType, estimateNumberTouched, savedEstimates]);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const markupAmount = subtotal * (markup / 100);
    const taxable = subtotal + markupAmount;
    const tax = taxable * (taxRate / 100);
    const total = taxable + tax;
    const depositAmount = Math.min(Math.max(deposit, 0), total);

    const balanceCredit = documentType === "Invoice" ? amountPaid : depositAmount;
    const balanceDue = Math.max(0, total - balanceCredit);

    return {
      balanceDue,
      depositAmount,
      markupAmount,
      subtotal,
      tax,
      taxable,
      total,
    };
  }, [amountPaid, deposit, documentType, items, markup, taxRate]);

  const filteredSavedEstimates = useMemo(
    () => {
      const query = historySearch.trim().toLowerCase();
      return savedEstimates.filter((estimate) => {
        const effectiveHistoryFilter = lockedDocumentType ?? historyFilter;
        const matchesFilter =
          effectiveHistoryFilter === "All" ||
          savedEstimateDocumentType(estimate) === effectiveHistoryFilter;
        if (!matchesFilter) return false;
        if (!query) return true;

        const searchText = [
          estimate.estimateNumber,
          estimate.clientName,
          estimate.jobsiteName,
          estimate.projectAddress,
          estimate.projectType,
          estimate.status,
          savedEstimateDocumentType(estimate),
        ]
          .join(" ")
          .toLowerCase();
        return searchText.includes(query);
      });
    },
    [historyFilter, historySearch, lockedDocumentType, savedEstimates],
  );

  const documentSnapshot = useMemo(
    () =>
      createDocumentSnapshot({
        amountPaid,
        chequingAccountNumber,
        clientEmail,
        clientName,
        datePrepared,
        deposit,
        documentType,
        dueDate,
        emailMessage,
        estimateNumber,
        hstNumber,
        items,
        jobsiteId,
        markup,
        notes,
        paymentTerms,
        projectAddress,
        projectType,
        status,
        taxRate,
        validFor,
      }),
    [
      amountPaid,
      chequingAccountNumber,
      clientEmail,
      clientName,
      datePrepared,
      deposit,
      documentType,
      dueDate,
      emailMessage,
      estimateNumber,
      hstNumber,
      items,
      jobsiteId,
      markup,
      notes,
      paymentTerms,
      projectAddress,
      projectType,
      status,
      taxRate,
      validFor,
    ],
  );
  const hasUnsavedChanges = activeEstimateId
    ? documentSnapshot !== lastSavedSnapshot
    : false;

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      { description: "New line item", quantity: 1, unit: "ea", unitPrice: 0 },
    ]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function printEstimate() {
    if (!validateDocument()) return;
    if (!confirmLatestVersion("export the PDF")) return;
    document.body.classList.add("estimate-printing");
    const cleanup = () => {
      document.body.classList.remove("estimate-printing");
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  function getCurrentDocumentFields(statusOverride = status): DocumentSnapshotFields {
    return {
      amountPaid,
      chequingAccountNumber,
      clientEmail,
      clientName,
      datePrepared,
      deposit,
      documentType,
      dueDate,
      emailMessage,
      estimateNumber,
      hstNumber,
      items,
      jobsiteId,
      markup,
      notes,
      paymentTerms,
      projectAddress,
      projectType,
      status: statusOverride,
      taxRate,
      validFor,
    };
  }

  function buildDocumentSnapshot(statusOverride = status) {
    return createDocumentSnapshot(getCurrentDocumentFields(statusOverride));
  }

  function buildSaveRequestBody(statusOverride = status) {
    return {
      clientName,
      estimateNumber,
      id: activeEstimateId,
      jobsiteId,
      payload: {
        deposit,
        amountPaid,
        chequingAccountNumber,
        clientEmail,
        datePrepared,
        documentType,
        dueDate,
        emailMessage,
        estimateNumber,
        hstNumber,
        items,
        markup,
        notes,
        paymentTerms,
        projectAddress,
        projectType,
        status: statusOverride,
        taxRate,
        validFor,
      },
      projectAddress,
      projectType,
      status: statusOverride,
      total: totals.total,
    };
  }

  async function persistEstimate(statusOverride = status) {
    const savedSnapshot = buildDocumentSnapshot(statusOverride);
    const requestBody = {
      ...buildSaveRequestBody(statusOverride),
    };
    const response = await fetch("/api/estimates", {
      body: JSON.stringify(requestBody),
      headers: { "Content-Type": "application/json" },
      method: activeEstimateId ? "PUT" : "POST",
    });
    const data = (await response.json()) as {
      error?: string;
      estimate?: SavedEstimate;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Unable to save estimate.");
    }
    if (data.estimate) {
      setSavedEstimates((current) => {
        const withoutCurrent = current.filter(
          (estimate) => estimate.id !== data.estimate!.id,
        );
        return [data.estimate!, ...withoutCurrent];
      });
      setActiveEstimateId(data.estimate.id);
    }
    setLastSavedSnapshot(savedSnapshot);
    setEstimateNumberTouched(true);
    window.dispatchEvent(new Event("va-employee-data-updated"));
    return data.estimate;
  }

  async function saveEstimate() {
    setSaveMessage("");
    if (!validateDocument()) return;
    try {
      await persistEstimate();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Unable to save estimate.");
      return;
    }
    setSaveMessage(
      activeEstimateId
        ? `${documentType} updated in history.`
        : `${documentType} saved to history.`,
    );
  }

  function startNewEstimate() {
    const preparedDate = todayIsoDate();
    setClientName("Client Name");
    setClientEmail("");
    setDocumentType(initialDocumentType);
    setActiveEstimateId(null);
    setJobsiteId("");
    setProjectAddress("Project address");
    setProjectType("Kitchen Renovation");
    setStatus("Draft");
    setDatePrepared(preparedDate);
    setEstimateNumber(
      buildNextDocumentNumber(savedEstimates, preparedDate, initialDocumentType),
    );
    setEstimateNumberTouched(false);
    setValidFor(14);
    setMarkup(10);
    setTaxRate(13);
    setDeposit(0);
    setPaymentTerms("Due upon receipt");
    setChequingAccountNumber(defaultChequingAccountNumber);
    setHstNumber(defaultHstNumber);
    setDueDate(addDaysIso(preparedDate, 14));
    setAmountPaid(0);
    setNotes(defaultNotes);
    setEmailMessage(defaultEmailMessage);
    setItems(initialItems);
    setEmailStatus("");
    setLastSavedSnapshot("");
    setValidationMessage("");
    setSaveMessage(`Started a new ${workspaceNoun}.`);
  }

  function loadSavedEstimate(estimate: SavedEstimate) {
    const payload = normalizeSavedEstimatePayload(estimate.payload);
    const loadedDate =
      payload.datePrepared || estimate.createdAt?.slice(0, 10) || todayIsoDate();
    const loadedDocumentType = payload.documentType || "Estimate";
    const loadedItems = payload.items?.length ? payload.items : initialItems;
    const loadedFields: DocumentSnapshotFields = {
      amountPaid: safeNumber(payload.amountPaid, 0),
      chequingAccountNumber:
        payload.chequingAccountNumber || defaultChequingAccountNumber,
      clientEmail: payload.clientEmail ?? "",
      clientName: estimate.clientName || "Client Name",
      datePrepared: loadedDate,
      deposit: safeNumber(payload.deposit, 0),
      documentType: lockedDocumentType ?? loadedDocumentType,
      dueDate: payload.dueDate || addDaysIso(loadedDate, 14),
      emailMessage: payload.emailMessage || defaultEmailMessage,
      estimateNumber: payload.estimateNumber || estimate.estimateNumber,
      hstNumber: normalizeHstNumber(payload.hstNumber),
      items: loadedItems,
      jobsiteId: estimate.jobsiteId ? String(estimate.jobsiteId) : "",
      markup: safeNumber(payload.markup, 10),
      notes: payload.notes || defaultNotes,
      paymentTerms: payload.paymentTerms || "Due upon receipt",
      projectAddress: payload.projectAddress || estimate.projectAddress || "Project address",
      projectType: payload.projectType || estimate.projectType || "General Renovation",
      status: payload.status || estimate.status || "Draft",
      taxRate: safeNumber(payload.taxRate, 13),
      validFor: safeNumber(payload.validFor, 14),
    };
    setActiveEstimateId(estimate.id);
    setClientName(loadedFields.clientName);
    setClientEmail(loadedFields.clientEmail);
    setDocumentType(loadedFields.documentType);
    setJobsiteId(loadedFields.jobsiteId);
    setDatePrepared(loadedFields.datePrepared);
    setProjectAddress(loadedFields.projectAddress);
    setProjectType(loadedFields.projectType);
    setStatus(loadedFields.status);
    setEstimateNumber(loadedFields.estimateNumber);
    setEstimateNumberTouched(true);
    setMarkup(loadedFields.markup);
    setTaxRate(loadedFields.taxRate);
    setDeposit(loadedFields.deposit);
    setPaymentTerms(loadedFields.paymentTerms);
    setChequingAccountNumber(loadedFields.chequingAccountNumber);
    setHstNumber(loadedFields.hstNumber);
    setDueDate(loadedFields.dueDate);
    setAmountPaid(loadedFields.amountPaid);
    setValidFor(loadedFields.validFor);
    setNotes(loadedFields.notes);
    setEmailMessage(loadedFields.emailMessage);
    setItems(loadedFields.items);
    setLastSavedSnapshot(createDocumentSnapshot(loadedFields));
    setSaveMessage(`Loaded ${estimate.estimateNumber}.`);
  }

  function duplicateSavedEstimate(estimate: SavedEstimate) {
    loadSavedEstimate(estimate);
    const preparedDate = todayIsoDate();
    setActiveEstimateId(null);
    setDatePrepared(preparedDate);
    setEstimateNumber(
      buildNextDocumentNumber(
        savedEstimates,
        preparedDate,
        lockedDocumentType ?? savedEstimateDocumentType(estimate),
      ),
    );
    setEstimateNumberTouched(false);
    setStatus("Draft");
    setLastSavedSnapshot("");
    setSaveMessage(`Duplicated ${estimate.estimateNumber}. Save when ready.`);
  }

  function convertSavedEstimateToInvoice(estimate: SavedEstimate) {
    loadSavedEstimate(estimate);
    const preparedDate = todayIsoDate();
    setActiveEstimateId(null);
    setDocumentType("Invoice");
    setStatus("Draft");
    setDatePrepared(preparedDate);
    setDueDate(addDaysIso(preparedDate, 14));
    setAmountPaid(0);
    setPaymentTerms("Due upon receipt");
    setChequingAccountNumber(defaultChequingAccountNumber);
    setHstNumber(defaultHstNumber);
    setEstimateNumber(
      buildNextDocumentNumber(savedEstimates, preparedDate, "Invoice"),
    );
    setEstimateNumberTouched(false);
    setLastSavedSnapshot("");
    setSaveMessage(`Created an invoice draft from ${estimate.estimateNumber}.`);
  }

  async function deleteSavedEstimate(estimate: SavedEstimate) {
    const label = `${savedEstimateDocumentType(estimate).toLowerCase()} ${
      estimate.estimateNumber
    }`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    setSaveMessage("");
    const response = await fetch("/api/estimates", {
      body: JSON.stringify({ id: estimate.id }),
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    });
    const data = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setSaveMessage(data.error ?? "Unable to delete saved document.");
      return;
    }

    setSavedEstimates((current) =>
      current.filter((savedEstimate) => savedEstimate.id !== estimate.id),
    );
    if (activeEstimateId === estimate.id) {
      startNewEstimate();
    }
    setSaveMessage(data.message ?? "Saved document deleted.");
    window.dispatchEvent(new Event("va-employee-data-updated"));
  }

  async function sendEstimateEmail() {
    setEmailStatus("");
    if (!validateDocument({ requireClientEmail: true })) return;
    if (!confirmLatestVersion("send the email")) return;

    const payload = buildEmailPayload();
    const response = await fetch("/api/estimate-email", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setEmailStatus(
        data.error?.includes("not configured")
          ? "Direct email is not configured yet. Use Copy email text or Open email draft below."
          : data.error ??
              "Unable to send directly. Use Copy email text or Open email draft below.",
      );
      return;
    }

    try {
      setStatus("Sent");
      await persistEstimate("Sent");
      setEmailStatus(data.message ?? `${documentType} email sent and saved as sent.`);
      setSaveMessage(`${documentType} saved as sent.`);
    } catch (error) {
      setEmailStatus(
        `${data.message ?? `${documentType} email sent.`} Save the sent status manually when you are back in the portal.`,
      );
      setSaveMessage(
        error instanceof Error ? error.message : "Unable to save sent status.",
      );
    }
  }

  function buildEmailPayload() {
    return {
      clientEmail,
      clientName,
      datePrepared,
      deposit,
      amountPaid,
      documentType,
      dueDate,
      employeeEmail,
      employeeName,
      estimateNumber,
      hstNumber,
      items,
      markup,
      message: emailMessage,
      notes,
      paymentTerms,
      projectAddress,
      projectType,
      taxRate,
      totals,
      validFor,
    };
  }

  function buildEmailDraft(payload: ReturnType<typeof buildEmailPayload>) {
    const subject = `VA Contracting ${payload.documentType.toLowerCase()} ${payload.estimateNumber}`;
    const body = [
      emailMessage,
      "",
      `${documentType}: ${estimateNumber}`,
      `Date prepared: ${formatDate(datePrepared)}`,
      `Client: ${clientName}`,
      `Project: ${projectType}`,
      `Address: ${projectAddress}`,
      documentType === "Invoice" ? `Due date: ${formatDate(dueDate)}` : "",
      documentType === "Invoice" ? `Payment terms: ${paymentTerms}` : "",
      documentType === "Invoice"
        ? `Chequing account number: ${chequingAccountNumber}`
        : "",
      documentType === "Invoice" ? `HST number: ${hstNumber}` : "",
      "",
      "Line items:",
      ...items.map(
        (item) =>
          `- ${item.description}: ${item.quantity} ${item.unit} x ${currency(item.unitPrice)} = ${currency(item.quantity * item.unitPrice)}`,
      ),
      "",
      `Price before HST: ${currency(totals.subtotal + totals.markupAmount)}`,
      `HST: ${currency(totals.tax)}`,
      `Total: ${currency(totals.total)}`,
      documentType === "Invoice"
        ? `Amount paid: ${currency(amountPaid)}`
        : `Down payment: ${currency(totals.depositAmount)}`,
      documentType === "Invoice"
        ? `Balance due: ${currency(totals.balanceDue)}`
        : `Balance after down payment: ${currency(totals.balanceDue)}`,
      "",
      `Notes: ${notes}`,
      "",
      `Regards,`,
      employeeName,
      employeeEmail,
      "VA Contracting",
    ].filter((line) => line !== "").join("\n");
    return { body, subject };
  }

  async function copyEmailDraft() {
    if (!validateDocument({ requireClientEmail: true })) return;
    const draft = buildEmailDraft(buildEmailPayload());
    const text = [`Subject: ${draft.subject}`, "", draft.body].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setEmailStatus("Email text copied. Paste it into your email app if direct sending is unavailable.");
    } catch {
      setEmailStatus(
        "Copy was blocked by the browser. Select the email message text manually, or try Open email draft.",
      );
    }
  }

  function openEmailDraft(payload: ReturnType<typeof buildEmailPayload>) {
    if (!validateDocument({ requireClientEmail: true })) return;
    const { body, subject } = buildEmailDraft(payload);
    const href = `mailto:${encodeURIComponent(payload.clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.assign(href);
    setEmailStatus(
      "Email draft requested. If your mail app did not open, use Copy email text instead.",
    );
  }

  function confirmLatestVersion(action: string) {
    if (activeEstimateId && !hasUnsavedChanges) return true;
    return window.confirm(
      `This ${documentType.toLowerCase()} has not been saved with the latest changes. ${capitalize(action)} anyway?`,
    );
  }

  function validateDocument(options: { requireClientEmail?: boolean } = {}) {
    const errors: string[] = [];
    const placeholderNames = ["client name", "project address"];

    if (!estimateNumber.trim()) errors.push("Add a document number.");
    if (!clientName.trim() || placeholderNames.includes(clientName.trim().toLowerCase())) {
      errors.push("Add the client's real name.");
    }
    if (
      !projectAddress.trim() ||
      placeholderNames.includes(projectAddress.trim().toLowerCase())
    ) {
      errors.push("Add the project address.");
    }
    if (options.requireClientEmail && !isEmail(clientEmail.trim())) {
      errors.push("Add a valid client email address.");
    }
    if (!items.length) errors.push("Add at least one line item.");

    items.forEach((item, index) => {
      const label = `Line ${index + 1}`;
      if (!item.description.trim() || item.description.trim() === "New line item") {
        errors.push(`${label}: add a real description.`);
      }
      if (!item.unit.trim()) errors.push(`${label}: add a unit.`);
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        errors.push(`${label}: quantity must be greater than zero.`);
      }
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
        errors.push(`${label}: unit price cannot be negative.`);
      }
    });

    if (!Number.isFinite(markup) || markup < 0) errors.push("Markup cannot be negative.");
    if (!Number.isFinite(taxRate) || taxRate < 0) errors.push("HST cannot be negative.");
    if (!Number.isFinite(deposit) || deposit < 0) {
      errors.push("Down payment cannot be negative.");
    }
    if (!Number.isFinite(validFor) || validFor < 1) {
      errors.push("Valid days must be at least 1.");
    }
    if (documentType === "Invoice" && (!Number.isFinite(amountPaid) || amountPaid < 0)) {
      errors.push("Amount paid cannot be negative.");
    }
    if (documentType === "Invoice" && !hstNumber.trim()) {
      errors.push("Add the HST number.");
    }

    const nextMessage = errors.slice(0, 4).join(" ");
    setValidationMessage(nextMessage);
    return errors.length === 0;
  }

  return (
    <section
      className={`estimate-workspace ${
        isInvoiceWorkspace ? "invoice-workspace" : "quote-workspace"
      }`}
      id={isInvoiceWorkspace ? "invoices" : "estimates"}
    >
      <div className="estimate-toolbar no-print">
        <div>
          <p className="eyebrow">
            {isInvoiceWorkspace ? "Invoice desk" : "Estimate worksheet"}
          </p>
          <h2>
            {isInvoiceWorkspace
              ? "Create and collect invoices."
              : "Build project estimates."}
          </h2>
          {activeEstimateId ? (
            <p className="estimate-active-document">
              Editing saved {documentType.toLowerCase()} {estimateNumber}
            </p>
          ) : null}
          <p
            className={`estimate-dirty-state ${
              activeEstimateId && !hasUnsavedChanges ? "saved" : "dirty"
            }`}
          >
            {activeEstimateId
              ? hasUnsavedChanges
                ? "Unsaved changes"
                : "All changes saved"
              : "New document not saved"}
          </p>
        </div>
        <div className="estimate-toolbar-actions">
          <button type="button" onClick={addItem}>
            Add line
          </button>
          <button type="button" onClick={startNewEstimate}>
            New {workspaceNoun}
          </button>
          <button type="button" onClick={saveEstimate}>
            Save {documentType.toLowerCase()}
          </button>
          <button className="print-button" type="button" onClick={printEstimate}>
            Export PDF
          </button>
        </div>
      </div>
      {validationMessage ? (
        <p className="estimate-validation-message no-print">{validationMessage}</p>
      ) : null}

      <section
        className="estimate-history-panel no-print"
        aria-label={`Saved ${workspaceNoun}s`}
      >
        <div className="estimate-history-heading">
          <div>
            <p className="eyebrow">Saved {workspaceNoun}s</p>
            <h3>Open a previous {workspaceNoun}.</h3>
          </div>
          <button type="button" onClick={loadEstimateWorkspace}>
            Refresh
          </button>
        </div>
        {!isLockedWorkspace ? (
          <div className="estimate-history-filters" aria-label="Filter saved documents">
            {(["All", "Estimate", "Invoice"] as HistoryFilter[]).map((filter) => (
              <button
                aria-pressed={historyFilter === filter}
                key={filter}
                type="button"
                onClick={() => setHistoryFilter(filter)}
              >
                {filter === "All" ? "All" : `${filter}s`}
              </button>
            ))}
          </div>
        ) : null}
        <label className="estimate-history-search">
          Search saved documents
          <input
            placeholder="Client, jobsite, address, document number..."
            type="search"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
          />
        </label>
        {historyLoading ? (
          <p className="estimate-history-empty">Loading saved estimates...</p>
        ) : null}
        {!historyLoading &&
        filteredSavedEstimates.length === 0 &&
        !historySearch.trim() ? (
          <p className="estimate-history-empty">
            Saved {workspaceNoun}s will appear here after you create the first{" "}
            {workspaceNoun}.
          </p>
        ) : null}
        {!historyLoading &&
        filteredSavedEstimates.length === 0 &&
        historySearch.trim() ? (
          <p className="estimate-history-empty">
            No saved {workspaceNoun}s match that search.
          </p>
        ) : null}
        {filteredSavedEstimates.length > 0 ? (
          <div className="estimate-history-list">
            {filteredSavedEstimates.map((estimate) => (
              <article key={estimate.id}>
                <div>
                  <span className={`estimate-status ${estimate.status.toLowerCase()}`}>
                    {estimate.status || "Draft"}
                  </span>
                  <strong>{estimate.estimateNumber}</strong>
                  <p>
                    {savedEstimateDocumentType(estimate)} for{" "}
                    {estimate.clientName || "unnamed client"} -{" "}
                    {estimate.projectType || "General project"}
                  </p>
                  <small>
                    {estimate.jobsiteName || estimate.projectAddress || "Unassigned"} |{" "}
                    {formatDate(estimate.createdAt)}
                  </small>
                </div>
                <div>
                  <b>{currency(estimate.total)}</b>
                  <div className="estimate-history-actions">
                    <button type="button" onClick={() => loadSavedEstimate(estimate)}>
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateSavedEstimate(estimate)}
                    >
                      Duplicate
                    </button>
                    {!isLockedWorkspace &&
                    savedEstimateDocumentType(estimate) === "Estimate" ? (
                      <button
                        type="button"
                        onClick={() => convertSavedEstimateToInvoice(estimate)}
                      >
                        Make invoice
                      </button>
                    ) : null}
                    <button type="button" onClick={() => deleteSavedEstimate(estimate)}>
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <div className="estimate-layout">
        <form className="estimate-form no-print">
          {isLockedWorkspace ? (
            <label>
              Document type
              <span className="estimate-form-readonly">{documentType}</span>
            </label>
          ) : (
            <label>
              Document type
              <select
                value={documentType}
                onChange={(event) => {
                  const nextType = event.target.value as DocumentType;
                  setDocumentType(nextType);
                  setStatus("Draft");
                  if (!estimateNumberTouched) {
                    setEstimateNumber(
                      buildNextDocumentNumber(savedEstimates, datePrepared, nextType),
                    );
                  }
                }}
              >
                <option>Estimate</option>
                <option>Invoice</option>
              </select>
            </label>
          )}
          <label>
            Jobsite
            <select
              value={jobsiteId}
              onChange={(event) => setJobsiteId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {jobsites.map((jobsite) => (
                <option key={jobsite.id} value={jobsite.id}>
                  {jobsite.name}
                  {jobsite.clientName ? ` - ${jobsite.clientName}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Client name
            <input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
            />
          </label>
          <label>
            Client email
            <input
              placeholder="client@example.com"
              type="email"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
            />
          </label>
          <label>
            Project address
            <input
              value={projectAddress}
              onChange={(event) => setProjectAddress(event.target.value)}
            />
          </label>
          <label>
            Project type
            <select
              value={projectType}
              onChange={(event) => setProjectType(event.target.value)}
            >
              <option>Kitchen Renovation</option>
              <option>Washroom Renovation</option>
              <option>Landscaping</option>
              <option>Deck Build</option>
              <option>General Renovation</option>
            </select>
          </label>
          <label>
            {documentType} #
            <input
              value={estimateNumber}
              onChange={(event) => {
                setEstimateNumberTouched(true);
                setEstimateNumber(event.target.value);
              }}
            />
          </label>
          <label>
            Date prepared
            <input
              type="date"
              value={datePrepared}
              onChange={(event) => setDatePrepared(event.target.value)}
            />
          </label>
          {documentType === "Invoice" ? (
            <>
              <label>
                Due date
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
              <label>
                Payment terms
                <input
                  value={paymentTerms}
                  onChange={(event) => setPaymentTerms(event.target.value)}
                />
              </label>
              <label>
                Chequing account number
                <input
                  value={chequingAccountNumber}
                  onChange={(event) => setChequingAccountNumber(event.target.value)}
                />
              </label>
              <label>
                HST number
                <input
                  value={hstNumber}
                  onChange={(event) => setHstNumber(event.target.value)}
                />
              </label>
            </>
          ) : null}
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {documentType === "Invoice" ? (
                <>
                  <option>Draft</option>
                  <option>Sent</option>
                  <option>Paid</option>
                  <option>Overdue</option>
                </>
              ) : (
                <>
                  <option>Draft</option>
                  <option>Sent</option>
                  <option>Approved</option>
                  <option>Declined</option>
                </>
              )}
            </select>
          </label>
          <div className="estimate-number-grid">
            <label>
              Markup %
              <input
                min="0"
                type="number"
                value={markup}
                onChange={(event) => setMarkup(Number(event.target.value))}
              />
            </label>
            <label>
              HST %
              <input
                min="0"
                type="number"
                value={taxRate}
                onChange={(event) => setTaxRate(Number(event.target.value))}
              />
            </label>
            {documentType === "Estimate" ? (
              <>
                <label>
                  Down payment
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={deposit}
                    onChange={(event) => setDeposit(Number(event.target.value))}
                  />
                </label>
                <label>
                  Valid days
                  <input
                    min="1"
                    type="number"
                    value={validFor}
                    onChange={(event) => setValidFor(Number(event.target.value))}
                  />
                </label>
              </>
            ) : null}
            {documentType === "Invoice" ? (
              <label>
                Amount paid
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(Number(event.target.value))}
                />
              </label>
            ) : null}
          </div>
          <label>
            Notes and exclusions
            <textarea
              rows={7}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <div className="estimate-email-panel">
            <div>
              <p className="eyebrow">Email {documentType.toLowerCase()}</p>
              <h3>Send directly to the client.</h3>
            </div>
            {emailSetupStatus ? (
              <p
                className={`estimate-email-setup ${
                  emailSetupStatus.configured ? "ready" : "missing"
                }`}
              >
                {emailSetupStatus.configured
                  ? `Direct email ready from ${emailSetupStatus.fromEmail}.`
                  : emailSetupStatus.error ||
                    "Direct email is not configured; email drafts still work."}
              </p>
            ) : (
              <p className="estimate-email-setup">Checking direct email setup...</p>
            )}
            <label>
              Email message
              <textarea
                rows={5}
                value={emailMessage}
                onChange={(event) => setEmailMessage(event.target.value)}
              />
            </label>
            <div className="estimate-email-actions">
              <button type="button" onClick={sendEstimateEmail}>
                Send {documentType.toLowerCase()}
              </button>
              <button type="button" onClick={copyEmailDraft}>
                Copy email text
              </button>
              <button type="button" onClick={() => openEmailDraft(buildEmailPayload())}>
                Open email draft
              </button>
            </div>
            {emailStatus ? <p className="estimate-email-status">{emailStatus}</p> : null}
          </div>
          {saveMessage ? <p className="estimate-save-message">{saveMessage}</p> : null}
        </form>

        <div className="estimate-sheet">
          <div className="estimate-sheet-header">
            <div>
              <img src="/va-logo.png" alt="" />
              <p>Commercial and Residential Construction</p>
            </div>
            <div>
              <span>{documentType}</span>
              <strong>{estimateNumber}</strong>
            </div>
          </div>

          <div className="estimate-parties">
            <div>
              <span>Prepared for</span>
              <strong>{clientName}</strong>
              <p>{projectAddress}</p>
            </div>
            <div>
              <span>Prepared by</span>
              <strong>{employeeName}</strong>
              <p>{employeeEmail}</p>
            </div>
            <div>
              <span>Project</span>
              <strong>{projectType}</strong>
              <p>Prepared {formatDate(datePrepared)}</p>
              {documentType === "Invoice" ? (
                <>
                  <p>Due {formatDate(dueDate)}</p>
                  <p>{paymentTerms}</p>
                </>
              ) : (
                <p>Valid for {validFor} days</p>
              )}
            </div>
          </div>

          <div className="estimate-table-wrap">
            <table className="estimate-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Unit price</th>
                  <th>Total</th>
                  <th className="no-print"> </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`estimate-line-${index}`}>
                    <td>
                      <input
                        className="screen-edit-field"
                        aria-label={`Line ${index + 1} description`}
                        value={item.description}
                        onChange={(event) =>
                          updateItem(index, { description: event.target.value })
                        }
                      />
                      <span className="print-field-value">{item.description}</span>
                    </td>
                    <td>
                      <input
                        className="screen-edit-field"
                        aria-label={`Line ${index + 1} quantity`}
                        min="0"
                        step="0.01"
                        type="number"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, {
                            quantity: Number(event.target.value),
                          })
                        }
                      />
                      <span className="print-field-value">{item.quantity}</span>
                    </td>
                    <td>
                      <input
                        className="screen-edit-field"
                        aria-label={`Line ${index + 1} unit`}
                        value={item.unit}
                        onChange={(event) =>
                          updateItem(index, { unit: event.target.value })
                        }
                      />
                      <span className="print-field-value">{item.unit}</span>
                    </td>
                    <td>
                      <input
                        className="screen-edit-field"
                        aria-label={`Line ${index + 1} unit price`}
                        min="0"
                        step="0.01"
                        type="number"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(index, {
                            unitPrice: Number(event.target.value),
                          })
                        }
                      />
                      <span className="print-field-value">{currency(item.unitPrice)}</span>
                    </td>
                    <td>{currency(item.quantity * item.unitPrice)}</td>
                    <td className="no-print">
                      <button
                        aria-label={`Remove line ${index + 1}`}
                        type="button"
                        onClick={() => removeItem(index)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="estimate-mobile-lines no-print">
            {items.map((item, index) => (
              <article className="estimate-line-card" key={`mobile-${index}`}>
                <div className="estimate-line-card-header">
                  <span>Line {index + 1}</span>
                  <strong>{currency(item.quantity * item.unitPrice)}</strong>
                </div>
                <label>
                  Description
                  <input
                    aria-label={`Mobile line ${index + 1} description`}
                    value={item.description}
                    onChange={(event) =>
                      updateItem(index, { description: event.target.value })
                    }
                  />
                </label>
                <div className="estimate-line-grid">
                  <label>
                    Qty
                    <input
                      aria-label={`Mobile line ${index + 1} quantity`}
                      min="0"
                      step="0.01"
                      type="number"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, { quantity: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Unit
                    <input
                      aria-label={`Mobile line ${index + 1} unit`}
                      value={item.unit}
                      onChange={(event) =>
                        updateItem(index, { unit: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Price
                    <input
                      aria-label={`Mobile line ${index + 1} unit price`}
                      min="0"
                      step="0.01"
                      type="number"
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(index, { unitPrice: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
                <button type="button" onClick={() => removeItem(index)}>
                  Remove line
                </button>
              </article>
            ))}
          </div>

          <div className="estimate-summary">
            <div className="estimate-notes">
              <strong>Notes</strong>
              <p>{notes}</p>
              {documentType === "Invoice" ? (
                <div className="invoice-payment-details">
                  <strong>Payment details</strong>
                  <p>Chequing account number: {chequingAccountNumber}</p>
                  <p>HST number: {hstNumber}</p>
                </div>
              ) : null}
            </div>
            <dl>
              <div>
                <dt>Price before HST</dt>
                <dd>{currency(totals.subtotal + totals.markupAmount)}</dd>
              </div>
              <div>
                <dt>HST</dt>
                <dd>{currency(totals.tax)}</dd>
              </div>
              <div className="grand-total">
                <dt>Total</dt>
                <dd>{currency(totals.total)}</dd>
              </div>
              <div>
                <dt>{documentType === "Invoice" ? "Amount paid" : "Down payment"}</dt>
                <dd>
                  {documentType === "Invoice"
                    ? currency(amountPaid)
                    : currency(totals.depositAmount)}
                </dd>
              </div>
              <div className="grand-total">
                <dt>
                  {documentType === "Invoice"
                    ? "Balance due"
                    : "Balance after down payment"}
                </dt>
                <dd>{currency(totals.balanceDue)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function currency(value: number) {
  return new Intl.NumberFormat("en-CA", {
    currency: "CAD",
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  if (!value) return "No date";
  const normalized = /^\d{4}-\d{2}-\d{2}/.test(value)
    ? `${value.slice(0, 10)}T00:00:00`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalizeSavedEstimatePayload(payload: unknown): SavedEstimatePayload {
  if (!payload || typeof payload !== "object") return {};
  const value = payload as SavedEstimatePayload;
  return {
    chequingAccountNumber:
      typeof value.chequingAccountNumber === "string"
        ? value.chequingAccountNumber
        : "",
    clientEmail: typeof value.clientEmail === "string" ? value.clientEmail : "",
    datePrepared:
      typeof value.datePrepared === "string" ? value.datePrepared.slice(0, 10) : "",
    deposit: safeNumber(value.deposit, 0),
    amountPaid: safeNumber(value.amountPaid, 0),
    documentType: validDocumentType(value.documentType)
      ? value.documentType
      : "Estimate",
    dueDate: typeof value.dueDate === "string" ? value.dueDate.slice(0, 10) : "",
    emailMessage: typeof value.emailMessage === "string" ? value.emailMessage : "",
    estimateNumber:
      typeof value.estimateNumber === "string" ? value.estimateNumber : "",
    hstNumber: typeof value.hstNumber === "string" ? value.hstNumber : "",
    items: Array.isArray(value.items) ? value.items.map(normalizeLineItem) : [],
    markup: safeNumber(value.markup, 10),
    notes: typeof value.notes === "string" ? value.notes : "",
    paymentTerms:
      typeof value.paymentTerms === "string" ? value.paymentTerms : "",
    projectAddress:
      typeof value.projectAddress === "string" ? value.projectAddress : "",
    projectType: typeof value.projectType === "string" ? value.projectType : "",
    status: typeof value.status === "string" ? value.status : "",
    taxRate: safeNumber(value.taxRate, 13),
    validFor: safeNumber(value.validFor, 14),
  };
}

function normalizeHstNumber(value: unknown) {
  if (typeof value !== "string") return defaultHstNumber;

  const trimmed = value.trim();
  return !trimmed || trimmed === "Add HST number" ? defaultHstNumber : trimmed;
}

function savedEstimateDocumentType(estimate: SavedEstimate) {
  const payload = normalizeSavedEstimatePayload(estimate.payload);
  return payload.documentType || "Estimate";
}

function validDocumentType(value: unknown): value is DocumentType {
  return value === "Estimate" || value === "Invoice";
}

function normalizeLineItem(item: unknown): LineItem {
  if (!item || typeof item !== "object") {
    return { description: "Line item", quantity: 1, unit: "ea", unitPrice: 0 };
  }
  const value = item as Partial<LineItem>;
  return {
    description:
      typeof value.description === "string" && value.description.trim()
        ? value.description
        : "Line item",
    quantity: safeNumber(value.quantity, 1),
    unit: typeof value.unit === "string" && value.unit.trim() ? value.unit : "ea",
    unitPrice: safeNumber(value.unitPrice, 0),
  };
}

function createDocumentSnapshot(fields: DocumentSnapshotFields) {
  return JSON.stringify(fields);
}

function safeNumber(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(value: string, days: number) {
  const normalized = /^\d{4}-\d{2}-\d{2}/.test(value)
    ? `${value.slice(0, 10)}T00:00:00`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return todayIsoDate();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildNextDocumentNumber(
  estimates: SavedEstimate[],
  datePrepared: string,
  documentType: DocumentType,
) {
  const year = yearFromDate(datePrepared);
  const highestSequence = estimates.reduce((highest, estimate) => {
    const payload = normalizeSavedEstimatePayload(estimate.payload);
    const estimateDocumentType = savedEstimateDocumentType(estimate);
    const estimateYear = yearFromDate(payload.datePrepared || estimate.createdAt);

    if (estimateDocumentType !== documentType || estimateYear !== year) {
      return highest;
    }

    return Math.max(highest, sequenceFromDocumentNumber(estimate.estimateNumber, year));
  }, 0);

  const nextSequence = String(highestSequence + 1).padStart(3, "0");
  return documentType === "Invoice"
    ? `INV-${year}-${nextSequence}`
    : `${year}-${nextSequence}`;
}

function sequenceFromDocumentNumber(value: string, year: number) {
  const escapedYear = String(year).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = value.match(new RegExp(`(?:^|-)${escapedYear}-(\\d{1,})$`));
  if (!match) return 0;
  return Number(match[1]) || 0;
}

function yearFromDate(value: string) {
  if (/^\d{4}/.test(value)) return Number(value.slice(0, 4));
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().getFullYear()
    : date.getFullYear();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
