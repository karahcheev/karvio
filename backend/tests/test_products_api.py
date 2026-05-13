from app.models.enums import ProjectMemberRole, TestCaseStatus
from app.modules.projects.models import Project, ProjectMember, Suite
from app.modules.test_cases.models import TestCase
from sqlalchemy.ext.asyncio import AsyncSession


async def _seed_project_with_membership(db_session: AsyncSession, project_id: str, user_id: str, role: ProjectMemberRole):
    project = Project(id=project_id, name=f"Project {project_id}")
    membership = ProjectMember(project_id=project_id, user_id=user_id, role=role)
    db_session.add_all([project, membership])
    await db_session.commit()
    return project


async def test_products_and_components_crud_and_links(client, db_session: AsyncSession, auth_headers):
    await _seed_project_with_membership(db_session, "proj_prod_1", "user_auth_1", ProjectMemberRole.lead)

    product_resp = await client.post(
        "/api/v1/products",
        json={"project_id": "proj_prod_1", "name": "Checkout"},
        headers=auth_headers,
    )
    assert product_resp.status_code == 201
    product = product_resp.json()
    assert product["key"] == "checkout"

    component_resp = await client.post(
        "/api/v1/components",
        json={
            "project_id": "proj_prod_1",
            "name": "Payment Gateway",
            "business_criticality": 5,
            "change_frequency": 4,
            "integration_complexity": 4,
            "defect_density": 3,
            "production_incident_score": 4,
            "automation_confidence": 1,
        },
        headers=auth_headers,
    )
    assert component_resp.status_code == 201
    component = component_resp.json()
    assert component["risk_score"] == 82
    assert component["risk_level"] == "critical"

    links_resp = await client.put(
        f"/api/v1/products/{product['id']}/components",
        json={"links": [{"component_id": component["id"], "is_core": True, "sort_order": 10}]},
        headers=auth_headers,
    )
    assert links_resp.status_code == 200
    assert links_resp.json()["items"][0]["is_core"] is True

    list_products = await client.get("/api/v1/products?project_id=proj_prod_1", headers=auth_headers)
    assert list_products.status_code == 200
    assert len(list_products.json()["items"]) == 1

    list_components = await client.get("/api/v1/components?project_id=proj_prod_1", headers=auth_headers)
    assert list_components.status_code == 200
    assert len(list_components.json()["items"]) == 1


async def test_component_dependencies_and_generation_preview(client, db_session: AsyncSession, auth_headers):
    project = await _seed_project_with_membership(db_session, "proj_prod_2", "user_auth_1", ProjectMemberRole.lead)
    suite = Suite(id="suite_prod_2", project_id=project.id, name="Suite")
    db_session.add(suite)

    tc_a = TestCase(
        id="tc_prod_prev_a",
        project_id=project.id,
        suite_id=suite.id,
        key="TC-PREV-A",
        title="A",
        status=TestCaseStatus.active,
        tags=[],
    )
    tc_b = TestCase(
        id="tc_prod_prev_b",
        project_id=project.id,
        suite_id=suite.id,
        key="TC-PREV-B",
        title="B",
        status=TestCaseStatus.active,
        tags=[],
    )
    db_session.add_all([tc_a, tc_b])
    await db_session.commit()

    product = (
        await client.post(
            "/api/v1/products",
            json={"project_id": project.id, "name": "Platform"},
            headers=auth_headers,
        )
    ).json()
    comp_a = (
        await client.post(
            "/api/v1/components",
            json={"project_id": project.id, "name": "API", "business_criticality": 4, "production_incident_score": 4},
            headers=auth_headers,
        )
    ).json()
    comp_b = (
        await client.post(
            "/api/v1/components",
            json={"project_id": project.id, "name": "DB", "business_criticality": 5, "production_incident_score": 5},
            headers=auth_headers,
        )
    ).json()

    await client.put(
        f"/api/v1/products/{product['id']}/components",
        json={"links": [{"component_id": comp_a["id"]}]},
        headers=auth_headers,
    )
    dep_replace = await client.put(
        f"/api/v1/components/{comp_a['id']}/dependencies",
        json={"dependencies": [{"target_component_id": comp_b["id"], "dependency_type": "depends_on"}]},
        headers=auth_headers,
    )
    assert dep_replace.status_code == 200

    await client.patch(
        f"/api/v1/test-cases/{tc_a.id}",
        json={
            "component_coverages": [
                {
                    "component_id": comp_a["id"],
                    "coverage_type": "direct",
                    "coverage_strength": "smoke",
                    "is_mandatory_for_release": True,
                }
            ]
        },
        headers=auth_headers,
    )
    await client.patch(
        f"/api/v1/test-cases/{tc_b.id}",
        json={
            "component_coverages": [
                {
                    "component_id": comp_b["id"],
                    "coverage_type": "direct",
                    "coverage_strength": "regression",
                }
            ]
        },
        headers=auth_headers,
    )

    preview_resp = await client.post(
        "/api/v1/test-plans/generate-preview",
        json={
            "project_id": project.id,
            "config": {
                "product_ids": [product["id"]],
                "component_ids": [],
                "include_dependent_components": True,
                "generation_mode": "smoke",
            },
        },
        headers=auth_headers,
    )
    assert preview_resp.status_code == 200
    preview = preview_resp.json()["preview"]
    assert comp_a["id"] in preview["resolved_component_ids"]
    assert comp_b["id"] in preview["resolved_component_ids"]
    assert tc_a.id in preview["resolved_case_ids"]


async def test_test_case_product_and_component_filters(client, db_session: AsyncSession, auth_headers):
    project = await _seed_project_with_membership(db_session, "proj_prod_3", "user_auth_1", ProjectMemberRole.lead)
    suite = Suite(id="suite_prod_3", project_id=project.id, name="Suite")
    db_session.add(suite)
    await db_session.commit()

    product = (
        await client.post(
            "/api/v1/products",
            json={"project_id": project.id, "name": "Billing"},
            headers=auth_headers,
        )
    ).json()
    component = (
        await client.post(
            "/api/v1/components",
            json={"project_id": project.id, "name": "Invoices"},
            headers=auth_headers,
        )
    ).json()

    create_case = await client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project.id,
            "suite_id": suite.id,
            "title": "Invoice test",
            "primary_product_id": product["id"],
            "component_coverages": [
                {
                    "component_id": component["id"],
                    "coverage_type": "direct",
                    "coverage_strength": "smoke",
                }
            ],
        },
        headers=auth_headers,
    )
    assert create_case.status_code == 201
    test_case_id = create_case.json()["id"]

    read_case = await client.get(f"/api/v1/test-cases/{test_case_id}", headers=auth_headers)
    assert read_case.status_code == 200
    assert read_case.json()["primary_product_id"] == product["id"]
    assert len(read_case.json()["component_coverages"]) == 1

    by_product = await client.get(
        f"/api/v1/test-cases?project_id={project.id}&product_id={product['id']}",
        headers=auth_headers,
    )
    assert by_product.status_code == 200
    assert len(by_product.json()["items"]) == 1

    by_component = await client.get(
        f"/api/v1/test-cases?project_id={project.id}&component_id={component['id']}",
        headers=auth_headers,
    )
    assert by_component.status_code == 200
    assert len(by_component.json()["items"]) == 1


async def test_generated_plan_persists_case_ids_and_create_run(client, db_session: AsyncSession, auth_headers):
    project = await _seed_project_with_membership(db_session, "proj_prod_4", "user_auth_1", ProjectMemberRole.lead)
    suite = Suite(id="suite_prod_4", project_id=project.id, name="Suite")
    tc = TestCase(
        id="tc_prod_plan_1",
        project_id=project.id,
        suite_id=suite.id,
        key="TC-PROD-PLAN-1",
        title="Plan Case",
        status=TestCaseStatus.active,
        tags=[],
    )
    db_session.add_all([suite, tc])
    await db_session.commit()

    product = (
        await client.post(
            "/api/v1/products",
            json={"project_id": project.id, "name": "Web"},
            headers=auth_headers,
        )
    ).json()
    component = (
        await client.post(
            "/api/v1/components",
            json={"project_id": project.id, "name": "UI"},
            headers=auth_headers,
        )
    ).json()
    await client.put(
        f"/api/v1/products/{product['id']}/components",
        json={"links": [{"component_id": component["id"]}]},
        headers=auth_headers,
    )
    await client.patch(
        f"/api/v1/test-cases/{tc.id}",
        json={
            "component_coverages": [
                {
                    "component_id": component["id"],
                    "coverage_type": "direct",
                    "coverage_strength": "smoke",
                    "is_mandatory_for_release": True,
                }
            ]
        },
        headers=auth_headers,
    )

    plan_resp = await client.post(
        "/api/v1/test-plans",
        json={
            "project_id": project.id,
            "name": "Generated Plan",
            "generation_source": "product_generated",
            "generation_config": {
                "product_ids": [product["id"]],
                "generation_mode": "smoke",
            },
            "suite_ids": [],
            "case_ids": [],
        },
        headers=auth_headers,
    )
    assert plan_resp.status_code == 201
    plan = plan_resp.json()
    assert plan["generation_source"] == "product_generated"
    assert tc.id in plan["case_ids"]

    run_resp = await client.post(
        f"/api/v1/test-plans/{plan['id']}/create-run",
        json={"name": "Generated Run", "start_immediately": False},
        headers=auth_headers,
    )
    assert run_resp.status_code == 201
    run_cases_resp = await client.get(
        f"/api/v1/run-cases?test_run_id={run_resp.json()['id']}",
        headers=auth_headers,
    )
    assert run_cases_resp.status_code == 200
    assert {item["test_case_id"] for item in run_cases_resp.json()["items"]} == {tc.id}

    summary_resp = await client.get(f"/api/v1/products/{product['id']}/summary", headers=auth_headers)
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert summary["total_components"] == 1
    assert summary["components_with_cases"] == 1
    assert summary["adequately_covered_components"] == 1
    assert summary["inadequately_covered_components"] == 0
    assert summary["mandatory_release_cases"] == 1


async def test_product_summary_adequacy_marks_high_risk_component_with_single_smoke_as_uncovered(
    client,
    db_session: AsyncSession,
    auth_headers,
):
    project = await _seed_project_with_membership(db_session, "proj_prod_5", "user_auth_1", ProjectMemberRole.lead)
    suite = Suite(id="suite_prod_5", project_id=project.id, name="Suite")
    tc = TestCase(
        id="tc_prod_adequacy_1",
        project_id=project.id,
        suite_id=suite.id,
        key="TC-PROD-ADEQ-1",
        title="Adequacy case",
        status=TestCaseStatus.active,
        tags=[],
    )
    db_session.add_all([suite, tc])
    await db_session.commit()

    product = (
        await client.post(
            "/api/v1/products",
            json={"project_id": project.id, "name": "Core Platform"},
            headers=auth_headers,
        )
    ).json()
    component = (
        await client.post(
            "/api/v1/components",
            json={
                "project_id": project.id,
                "name": "Auth",
                "business_criticality": 5,
                "change_frequency": 4,
                "integration_complexity": 4,
                "defect_density": 4,
                "production_incident_score": 5,
                "automation_confidence": 1,
            },
            headers=auth_headers,
        )
    ).json()
    await client.put(
        f"/api/v1/products/{product['id']}/components",
        json={"links": [{"component_id": component["id"]}]},
        headers=auth_headers,
    )
    await client.patch(
        f"/api/v1/test-cases/{tc.id}",
        json={
            "component_coverages": [
                {
                    "component_id": component["id"],
                    "coverage_type": "direct",
                    "coverage_strength": "smoke",
                }
            ]
        },
        headers=auth_headers,
    )

    summary_resp = await client.get(f"/api/v1/products/{product['id']}/summary", headers=auth_headers)
    assert summary_resp.status_code == 200
    summary = summary_resp.json()

    assert summary["components_with_cases"] == 1
    assert summary["adequately_covered_components"] == 0
    assert summary["inadequately_covered_components"] == 1
    assert summary["uncovered_components"] == 1
    assert summary["high_risk_uncovered_components"] == 1
    assert summary["coverage_score_total"] == 1
    assert summary["required_coverage_score_total"] >= 4
    breakdown = summary["per_component_breakdown"][0]
    assert breakdown["coverage_score"] == 1
    assert breakdown["adequately_covered"] is False
    assert breakdown["uncovered"] is True


async def test_component_dependency_cycle_is_rejected(client, db_session: AsyncSession, auth_headers):
    project = await _seed_project_with_membership(db_session, "proj_prod_6", "user_auth_1", ProjectMemberRole.lead)

    component_a = (
        await client.post(
            "/api/v1/components",
            json={"project_id": project.id, "name": "A"},
            headers=auth_headers,
        )
    ).json()
    component_b = (
        await client.post(
            "/api/v1/components",
            json={"project_id": project.id, "name": "B"},
            headers=auth_headers,
        )
    ).json()

    first_link = await client.put(
        f"/api/v1/components/{component_b['id']}/dependencies",
        json={"dependencies": [{"target_component_id": component_a["id"], "dependency_type": "depends_on"}]},
        headers=auth_headers,
    )
    assert first_link.status_code == 200

    cycle_attempt = await client.put(
        f"/api/v1/components/{component_a['id']}/dependencies",
        json={"dependencies": [{"target_component_id": component_b["id"], "dependency_type": "depends_on"}]},
        headers=auth_headers,
    )
    assert cycle_attempt.status_code == 422
    payload = cycle_attempt.json()
    assert payload["code"] == "component_dependency_cycle"


async def test_generation_preview_regression_mode_includes_dependency_chain_cases(
    client,
    db_session: AsyncSession,
    auth_headers,
):
    project = await _seed_project_with_membership(db_session, "proj_prod_7", "user_auth_1", ProjectMemberRole.lead)
    suite = Suite(id="suite_prod_7", project_id=project.id, name="Suite")
    db_session.add(suite)

    tc_a = TestCase(
        id="tc_prod_reg_a",
        project_id=project.id,
        suite_id=suite.id,
        key="TC-PROD-REG-A",
        title="A",
        status=TestCaseStatus.active,
        tags=[],
    )
    tc_c = TestCase(
        id="tc_prod_reg_c",
        project_id=project.id,
        suite_id=suite.id,
        key="TC-PROD-REG-C",
        title="C",
        status=TestCaseStatus.active,
        tags=[],
    )
    db_session.add_all([tc_a, tc_c])
    await db_session.commit()

    product = (
        await client.post(
            "/api/v1/products",
            json={"project_id": project.id, "name": "Platform"},
            headers=auth_headers,
        )
    ).json()
    comp_a = (
        await client.post(
            "/api/v1/components",
            json={"project_id": project.id, "name": "API"},
            headers=auth_headers,
        )
    ).json()
    comp_b = (
        await client.post(
            "/api/v1/components",
            json={"project_id": project.id, "name": "Workers"},
            headers=auth_headers,
        )
    ).json()
    comp_c = (
        await client.post(
            "/api/v1/components",
            json={"project_id": project.id, "name": "Storage"},
            headers=auth_headers,
        )
    ).json()

    await client.put(
        f"/api/v1/products/{product['id']}/components",
        json={"links": [{"component_id": comp_a["id"]}]},
        headers=auth_headers,
    )
    await client.put(
        f"/api/v1/components/{comp_a['id']}/dependencies",
        json={"dependencies": [{"target_component_id": comp_b["id"], "dependency_type": "depends_on"}]},
        headers=auth_headers,
    )
    await client.put(
        f"/api/v1/components/{comp_b['id']}/dependencies",
        json={"dependencies": [{"target_component_id": comp_c["id"], "dependency_type": "depends_on"}]},
        headers=auth_headers,
    )

    await client.patch(
        f"/api/v1/test-cases/{tc_a.id}",
        json={
            "component_coverages": [
                {
                    "component_id": comp_a["id"],
                    "coverage_type": "direct",
                    "coverage_strength": "regression",
                }
            ]
        },
        headers=auth_headers,
    )
    await client.patch(
        f"/api/v1/test-cases/{tc_c.id}",
        json={
            "component_coverages": [
                {
                    "component_id": comp_c["id"],
                    "coverage_type": "direct",
                    "coverage_strength": "regression",
                }
            ]
        },
        headers=auth_headers,
    )

    preview_resp = await client.post(
        "/api/v1/test-plans/generate-preview",
        json={
            "project_id": project.id,
            "config": {
                "product_ids": [product["id"]],
                "component_ids": [],
                "include_dependent_components": True,
                "generation_mode": "regression",
            },
        },
        headers=auth_headers,
    )
    assert preview_resp.status_code == 200
    preview = preview_resp.json()["preview"]

    assert {comp_a["id"], comp_b["id"], comp_c["id"]}.issubset(set(preview["resolved_component_ids"]))
    assert {tc_a.id, tc_c.id}.issubset(set(preview["resolved_case_ids"]))
    assert all("regression_rule" in item["reason_codes"] for item in preview["included_cases"])
