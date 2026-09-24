/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import "server-only";
import { PrismaClient, Prisma, RoleName, AccountStatus, PaymentPlan, PaymentMode } from "@prisma/client";

// In-memory fallback database store for AI Studio environment
class MockStore {
  users = new Map<string, any>();
  roles = new Map<string, any>();
  permissions = new Map<string, any>();
  userPermissions = new Map<string, any>();
  sessions = new Map<string, any>();
  parents = new Map<string, any>();
  students = new Map<string, any>();
  courses = new Map<string, any>();
  batches = new Map<string, any>();
  enrollments = new Map<string, any>();
  invoices = new Map<string, any>();
  invoiceItems = new Map<string, any>();
  payments = new Map<string, any>();
  systemSettings = new Map<string, any>();
  marketingExpenses = new Map<string, any>();
  monthlyTargets = new Map<string, any>();
  reminderResolutions = new Map<string, any>();
  deliveryAttempts = new Map<string, any>();
  auditLogs = new Map<string, any>();
  numberSequences = new Map<string, any>();

  constructor() {
    this.seed();
  }

  seed() {
    // Roles
    for (const name of ["ADMIN", "STAFF", "PARENT"] as RoleName[]) {
      this.roles.set(name, { name, createdAt: new Date(), updatedAt: new Date() });
    }

    // Permissions
    const allPerms = [
      "dashboard.view", "students.view", "students.create", "students.edit",
      "parents.view", "parents.create", "parents.edit",
      "courses.view", "courses.manage", "batches.view", "batches.manage",
      "enrollments.manage", "invoices.view", "invoices.create", "invoices.cancel",
      "payments.view", "payments.create", "reports.sales", "reports.courses",
      "reports.payments", "reports.marketing", "marketing.view", "marketing.create",
      "notifications.view", "whatsapp.send", "users.manage"
    ];
    for (const key of allPerms) {
      this.permissions.set(key, { key, createdAt: new Date(), updatedAt: new Date() });
    }

    // Pre-seeded Admin User
    // password is "Admin@123456"
    // sha256 hash with salt "seed123": seed123Admin@123456 -> 5f34cfec498db2571216503c8b417efcffc449339e088d8b6727282cb98fc028
    const adminUser = {
      id: "admin-1",
      email: "admin@futureminds.local",
      name: "Administrator",
      mobile: "9876543210",
      passwordHash: "sha256$seed123$5f34cfec498db2571216503c8b417efcffc449339e088d8b6727282cb98fc028",
      roleName: "ADMIN" as RoleName,
      status: "APPROVED" as AccountStatus,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    this.users.set(adminUser.id, adminUser);
    for (const key of allPerms) {
      this.userPermissions.set(`admin-1:${key}`, {
        userId: "admin-1",
        permissionKey: key,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Courses
    const course1 = {
      id: "course-1",
      name: "Robotics Starter (L1)",
      description: "Introductory robotics, sensors, and basic circuits",
      duration: 6,
      monthlyFee: new Prisma.Decimal(2500),
      fullFee: new Prisma.Decimal(14000),
      active: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    const course2 = {
      id: "course-2",
      name: "AI & Python for Kids (L2)",
      description: "Python logic, AI concepts, and smart models",
      duration: 6,
      monthlyFee: new Prisma.Decimal(3000),
      fullFee: new Prisma.Decimal(16500),
      active: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    this.courses.set(course1.id, course1);
    this.courses.set(course2.id, course2);

    // Batches
    const batch1 = {
      id: "batch-1",
      courseId: "course-1",
      name: "Weekend Batch A",
      schedule: "Sat-Sun 10:00 AM - 11:30 AM",
      active: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    this.batches.set(batch1.id, batch1);

    // Parent
    const parent1 = {
      id: "parent-1",
      userId: null,
      name: "Rajesh Sharma",
      mobile: "9876543210",
      whatsapp: "9876543210",
      email: "rajesh@example.com",
      address: "Plot 42, Hitech City, Hyderabad",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500081",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    this.parents.set(parent1.id, parent1);

    // Student
    const student1 = {
      id: "student-1",
      studentCode: "FM-2026-001",
      name: "Aarav Sharma",
      dateOfBirth: new Date("2014-05-12"),
      grade: "Grade 6",
      school: "Delhi Public School",
      parentId: "parent-1",
      active: true,
      createdAt: new Date("2026-01-05"),
      updatedAt: new Date("2026-01-05"),
    };
    this.students.set(student1.id, student1);

    // Enrollment
    const enrollment1 = {
      id: "enroll-1",
      studentId: "student-1",
      courseId: "course-1",
      batchId: "batch-1",
      enrollmentDate: new Date("2026-01-10"),
      paymentPlan: "MONTHLY" as PaymentPlan,
      fee: new Prisma.Decimal(2500),
      scholarship: new Prisma.Decimal(0),
      discount: new Prisma.Decimal(0),
      billingDay: 1,
      dueDay: 10,
      active: true,
      createdAt: new Date("2026-01-10"),
      updatedAt: new Date("2026-01-10"),
    };
    this.enrollments.set(enrollment1.id, enrollment1);

    // Invoices
    const invoice1 = {
      id: "inv-1",
      number: "FM-2026-0001",
      enrollmentId: "enroll-1",
      periodKey: "2026-09",
      activeKey: "enroll-1:2026-09",
      studentName: "Aarav Sharma",
      studentCode: "FM-2026-001",
      parentName: "Rajesh Sharma",
      parentAddress: "Plot 42, Hitech City, Hyderabad",
      courseName: "Robotics Starter (L1)",
      paymentPlan: "MONTHLY" as PaymentPlan,
      gross: new Prisma.Decimal(2500),
      scholarship: new Prisma.Decimal(0),
      discount: new Prisma.Decimal(0),
      total: new Prisma.Decimal(2500),
      invoiceDate: new Date("2026-09-01"),
      dueDate: new Date("2026-09-10"),
      createdById: "admin-1",
      cancelledAt: null,
      cancelledById: null,
      cancelReason: null,
      createdAt: new Date("2026-09-01"),
      updatedAt: new Date("2026-09-01"),
    };
    this.invoices.set(invoice1.id, invoice1);

    const item1 = {
      id: "item-1",
      invoiceId: "inv-1",
      description: "Tuition Fee - Robotics Starter (September 2026)",
      amount: new Prisma.Decimal(2500),
      createdAt: new Date("2026-09-01"),
    };
    this.invoiceItems.set(item1.id, item1);

    const pay1 = {
      id: "pay-1",
      requestKey: "req-1",
      invoiceId: "inv-1",
      amount: new Prisma.Decimal(2500),
      mode: "UPI" as PaymentMode,
      reference: "UPI/98765432/01",
      paidAt: new Date("2026-09-05"),
      recordedById: "admin-1",
      createdAt: new Date("2026-09-05"),
    };
    this.payments.set(pay1.id, pay1);

    // Settings
    this.systemSettings.set("institute", {
      key: "institute",
      value: {
        name: "Future Minds Robotics & AI Institute",
        address: "Plot 42, Hitech City, Hyderabad",
        phone: "+91 98765 43210",
        email: "contact@futureminds.edu",
        website: "https://futureminds.edu",
        gstin: "",
        invoicePrefix: "FM-2026-",
        paymentTerms: "10",
      },
      updatedAt: new Date(),
    });
    this.systemSettings.set("automation", {
      key: "automation",
      value: {
        active: true,
        emailReminders: false,
        hour: 9,
        reminderDays: "7,3,1,0",
      },
      updatedAt: new Date(),
    });
  }
}

const mockStore = new MockStore();

// Helper to filter objects matching Prisma-like where clauses
function matchRecord(record: any, where?: any): boolean {
  if (!where || Object.keys(where).length === 0) return true;
  for (const [key, val] of Object.entries(where)) {
    if (key === "AND" && Array.isArray(val)) {
      if (!val.every((clause) => matchRecord(record, clause))) return false;
      continue;
    }
    if (key === "OR" && Array.isArray(val)) {
      if (!val.some((clause) => matchRecord(record, clause))) return false;
      continue;
    }
    if (key === "NOT") {
      if (matchRecord(record, val)) return false;
      continue;
    }
    const recVal = record[key];
    const vAny = val as any;
    if (val !== null && typeof val === "object" && !(val instanceof Date) && !(val instanceof Prisma.Decimal)) {
      if ("contains" in val) {
        const needle = String(vAny.contains).toLowerCase();
        const haystack = String(recVal ?? "").toLowerCase();
        if (!haystack.includes(needle)) return false;
        continue;
      }
      if ("gte" in val && recVal < vAny.gte) return false;
      if ("lte" in val && recVal > vAny.lte) return false;
      if ("gt" in val && recVal <= vAny.gt) return false;
      if ("lt" in val && recVal >= vAny.lt) return false;
      if ("in" in val && Array.isArray(vAny.in) && !vAny.in.includes(recVal)) return false;
      if ("equals" in val && recVal !== vAny.equals) return false;
      // Relation match
      if (recVal !== undefined && typeof recVal === "object") {
        if (!matchRecord(recVal, val)) return false;
        continue;
      }
      continue;
    }
    if (recVal !== val) return false;
  }
  return true;
}

function createModelHandler(modelName: string, getMap: () => Map<string, any>) {
  return {
    async findMany(args: any = {}) {
      const map = getMap();
      let records = Array.from(map.values()).map((r) => populateRelations(modelName, { ...r }, args.include));
      if (args.where) {
        records = records.filter((r) => matchRecord(r, args.where));
      }
      if (args.orderBy) {
        const orderKey = Object.keys(args.orderBy)[0];
        const dir = args.orderBy[orderKey] === "desc" ? -1 : 1;
        records.sort((a, b) => (a[orderKey] > b[orderKey] ? dir : a[orderKey] < b[orderKey] ? -dir : 0));
      }
      const skip = args.skip || 0;
      const take = args.take !== undefined ? args.take : records.length;
      return records.slice(skip, skip + take);
    },

    async findUnique(args: any = {}) {
      const map = getMap();
      for (const record of map.values()) {
        if (matchRecord(record, args.where)) {
          return populateRelations(modelName, { ...record }, args.include);
        }
      }
      return null;
    },

    async findFirst(args: any = {}) {
      const list = await this.findMany({ ...args, take: 1 });
      return list[0] ?? null;
    },

    async create(args: any = {}) {
      const map = getMap();
      const id = args.data.id || `${modelName.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newRec = {
        ...args.data,
        id,
        createdAt: args.data.createdAt || new Date(),
        updatedAt: args.data.updatedAt || new Date(),
      };
      // Handle nested creates if any
      if (args.data.parent?.create) {
        const parentId = `parent-${Date.now()}`;
        mockStore.parents.set(parentId, { id: parentId, ...args.data.parent.create, userId: id });
        delete newRec.parent;
      }
      map.set(id, newRec);
      return populateRelations(modelName, { ...newRec }, args.include);
    },

    async update(args: any = {}) {
      const map = getMap();
      let existingKey: string | null = null;
      let existingRecord: any = null;
      for (const [k, v] of map.entries()) {
        if (matchRecord(v, args.where)) {
          existingKey = k;
          existingRecord = v;
          break;
        }
      }
      if (!existingKey) {
        const id = args.where.id || `${modelName.toLowerCase()}-${Date.now()}`;
        const created = { id, ...args.data, updatedAt: new Date() };
        map.set(id, created);
        return created;
      }
      const updated = { ...existingRecord, ...args.data, updatedAt: new Date() };
      map.set(existingKey, updated);
      return populateRelations(modelName, { ...updated }, args.include);
    },

    async delete(args: any = {}) {
      const map = getMap();
      for (const [k, v] of map.entries()) {
        if (matchRecord(v, args.where)) {
          map.delete(k);
          return v;
        }
      }
      return {};
    },

    async upsert(args: any = {}) {
      const existing = await this.findUnique({ where: args.where });
      if (existing) {
        return this.update({ where: args.where, data: args.update, include: args.include });
      }
      return this.create({ data: args.create, include: args.include });
    },

    async count(args: any = {}) {
      const items = await this.findMany(args);
      return items.length;
    },

    async aggregate(args: any = {}) {
      const items = await this.findMany(args);
      let sumAmount = new Prisma.Decimal(0);
      for (const it of items) {
        if (it.amount) sumAmount = sumAmount.plus(new Prisma.Decimal(it.amount));
        else if (it.total) sumAmount = sumAmount.plus(new Prisma.Decimal(it.total));
      }
      return {
        _sum: { amount: sumAmount, total: sumAmount },
        _count: items.length,
      };
    },
  };
}

function populateRelations(modelName: string, record: any, include?: any): any {
  if (!include || !record) return record;

  if (modelName === "user") {
    if (include.permissions) {
      record.permissions = Array.from(mockStore.userPermissions.values()).filter((up) => up.userId === record.id);
    }
    if (include.parent) {
      record.parent = Array.from(mockStore.parents.values()).find((p) => p.userId === record.id) || null;
    }
  }

  if (modelName === "session") {
    if (include.user) {
      const u = mockStore.users.get(record.userId);
      record.user = populateRelations("user", { ...u }, include.user?.include || { permissions: true });
    }
  }

  if (modelName === "student") {
    if (include.parent) {
      record.parent = mockStore.parents.get(record.parentId) || null;
    }
    if (include.enrollments) {
      const ens = Array.from(mockStore.enrollments.values()).filter((e) => e.studentId === record.id);
      record.enrollments = ens.map((e) => populateRelations("enrollment", { ...e }, include.enrollments?.include));
    }
  }

  if (modelName === "parent") {
    if (include.students) {
      record.students = Array.from(mockStore.students.values()).filter((s) => s.parentId === record.id);
    }
    if (include._count?.select?.students) {
      record._count = { students: Array.from(mockStore.students.values()).filter((s) => s.parentId === record.id).length };
    }
  }

  if (modelName === "course") {
    if (include.batches) {
      record.batches = Array.from(mockStore.batches.values()).filter((b) => b.courseId === record.id);
    }
  }

  if (modelName === "batch") {
    if (include.course) {
      record.course = mockStore.courses.get(record.courseId) || null;
    }
  }

  if (modelName === "enrollment") {
    if (include.student) {
      record.student = populateRelations("student", { ...mockStore.students.get(record.studentId) }, include.student?.include);
    }
    if (include.course) {
      record.course = mockStore.courses.get(record.courseId) || null;
    }
    if (include.batch) {
      record.batch = mockStore.batches.get(record.batchId) || null;
    }
    if (include.invoices) {
      const invs = Array.from(mockStore.invoices.values()).filter((i) => i.enrollmentId === record.id);
      record.invoices = invs.map((i) => populateRelations("invoice", { ...i }, include.invoices?.include));
    }
  }

  if (modelName === "invoice") {
    if (include.payments) {
      record.payments = Array.from(mockStore.payments.values()).filter((p) => p.invoiceId === record.id);
    }
    if (include.items) {
      record.items = Array.from(mockStore.invoiceItems.values()).filter((it) => it.invoiceId === record.id);
    }
    if (include.enrollment) {
      record.enrollment = populateRelations("enrollment", { ...mockStore.enrollments.get(record.enrollmentId) }, include.enrollment?.include);
    }
    if (include.createdBy) {
      record.createdBy = mockStore.users.get(record.createdById) || null;
    }
  }

  if (modelName === "payment") {
    if (include.invoice) {
      record.invoice = populateRelations("invoice", { ...mockStore.invoices.get(record.invoiceId) }, include.invoice?.include);
    }
  }

  if (modelName === "deliveryAttempt") {
    if (include.invoice) {
      record.invoice = populateRelations("invoice", { ...mockStore.invoices.get(record.invoiceId) }, include.invoice?.include);
    }
  }

  if (modelName === "auditLog") {
    if (include.actor) {
      record.actor = mockStore.users.get(record.actorId) || null;
    }
  }

  return record;
}

const mockDb: any = {
  user: createModelHandler("user", () => mockStore.users),
  role: createModelHandler("role", () => mockStore.roles),
  permission: createModelHandler("permission", () => mockStore.permissions),
  userPermission: createModelHandler("userPermission", () => mockStore.userPermissions),
  session: createModelHandler("session", () => mockStore.sessions),
  authThrottle: createModelHandler("authThrottle", () => mockStore.numberSequences),
  parent: createModelHandler("parent", () => mockStore.parents),
  student: createModelHandler("student", () => mockStore.students),
  course: createModelHandler("course", () => mockStore.courses),
  batch: createModelHandler("batch", () => mockStore.batches),
  enrollment: createModelHandler("enrollment", () => mockStore.enrollments),
  invoice: createModelHandler("invoice", () => mockStore.invoices),
  invoiceItem: createModelHandler("invoiceItem", () => mockStore.invoiceItems),
  payment: createModelHandler("payment", () => mockStore.payments),
  systemSetting: createModelHandler("systemSetting", () => mockStore.systemSettings),
  marketingExpense: createModelHandler("marketingExpense", () => mockStore.marketingExpenses),
  monthlyTarget: createModelHandler("monthlyTarget", () => mockStore.monthlyTargets),
  reminderResolution: createModelHandler("reminderResolution", () => mockStore.reminderResolutions),
  deliveryAttempt: createModelHandler("deliveryAttempt", () => mockStore.deliveryAttempts),
  auditLog: createModelHandler("auditLog", () => mockStore.auditLogs),
  numberSequence: createModelHandler("numberSequence", () => mockStore.numberSequences),

  async $transaction(input: any) {
    if (typeof input === "function") {
      return input(mockDb);
    }
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return input;
  },

  async $queryRaw(strings: TemplateStringsArray, ...values: any[]) {
    return [{ attempts: 1 }];
  },

  async $executeRaw(strings: TemplateStringsArray, ...values: any[]) {
    return 1;
  },

  async $disconnect() {},
};

export const db: PrismaClient = mockDb as unknown as PrismaClient;
