const fs = require('fs');
let c = fs.readFileSync('tests/encounter.integration.test.ts', 'utf8');

c = c.replace(/const createPat = async[\s\S]*?inactiveProviderToken = d5\.token;/g, `const createPat = async (email) => {
      const user = await prisma.user.create({ data: { email, role: "PATIENT" } });
      const pat = await prisma.patientProfile.create({ data: { userId: user.id, firstName: "Pat", lastName: email } });
      const token = jwt.sign({ id: user.id, email: user.email, role: "PATIENT" }, process.env.JWT_SECRET || "supersecret", { expiresIn: "1h" });
      return { user, pat, token };
    };
    
    const p1 = await createPat("pat_a@test.com"); patA = p1.pat; patientTokenA = p1.token;
    const p2 = await createPat("pat_b@test.com"); patB = p2.pat; patientTokenB = p2.token;

    const createDoc = async (email, hospId, role, deptId, status = "ACTIVE") => {
      const user = await prisma.user.create({ data: { email, role: "PROVIDER" } });
      await prisma.doctorProfile.create({ data: { userId: user.id, firstName: "Doc", lastName: email } });
      await prisma.hospitalMembership.create({ data: { userId: user.id, hospitalId: hospId, role, departmentId: deptId, status } });
      const token = jwt.sign({ id: user.id, email: user.email, role: "PROVIDER" }, process.env.JWT_SECRET || "supersecret", { expiresIn: "1h" });
      return { user, token };
    };

    const d1 = await createDoc("admin_a@test.com", hospA.id, MembershipRole.HOSPITAL_ADMIN); adminA = d1.user; adminTokenHospA = d1.token;
    const d2 = await createDoc("admin_b@test.com", hospB.id, MembershipRole.HOSPITAL_ADMIN); adminB = d2.user; adminTokenHospB = d2.token;
    const d3 = await createDoc("doc_a@test.com", hospA.id, MembershipRole.DOCTOR, deptA.id); docA = d3.user; providerTokenHospA = d3.token;
    const d4 = await createDoc("doc_b@test.com", hospB.id, MembershipRole.DOCTOR, deptB.id); docB = d4.user; providerTokenHospB = d4.token;
    const d5 = await createDoc("doc_inactive@test.com", hospA.id, MembershipRole.DOCTOR, deptA.id, "INACTIVE"); inactiveDoc = d5.user; inactiveProviderToken = d5.token;`);

fs.writeFileSync('tests/encounter.integration.test.ts', c, 'utf8');
