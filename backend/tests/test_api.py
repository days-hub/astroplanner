class TestAuth:
    def test_register_login_me(self, client, make_user):
        headers = make_user("alice@example.com")
        r = client.get("/auth/me", headers=headers)
        assert r.status_code == 200
        assert r.json()["email"] == "alice@example.com"

    def test_duplicate_email_rejected(self, client, make_user):
        make_user("bob@example.com")
        r = client.post(
            "/auth/register",
            json={"email": "bob@example.com", "password": "hunter22"},
        )
        assert r.status_code == 400

    def test_short_password_rejected(self, client):
        r = client.post(
            "/auth/register",
            json={"email": "short@example.com", "password": "abc"},
        )
        assert r.status_code == 422

    def test_email_case_insensitive(self, client, make_user):
        make_user("MixedCase@Example.com")
        # Same address, different case → duplicate
        r = client.post(
            "/auth/register",
            json={"email": "mixedcase@example.com", "password": "hunter22"},
        )
        assert r.status_code == 400

        # Login works regardless of the case typed
        r = client.post(
            "/auth/login",
            data={"username": "MIXEDCASE@EXAMPLE.COM", "password": "hunter22"},
        )
        assert r.status_code == 200

    def test_wrong_password(self, client, make_user):
        make_user("carol@example.com")
        r = client.post(
            "/auth/login",
            data={"username": "carol@example.com", "password": "wrong-password"},
        )
        assert r.status_code == 401

    def test_protected_routes_require_token(self, client):
        assert client.get("/locations/").status_code == 401
        assert client.get("/sessions/").status_code == 401
        assert client.get("/planner/ics").status_code == 401


class TestOwnershipIsolation:
    def test_cannot_read_other_users_location(self, client, make_user, make_location):
        alice = make_user()
        bob = make_user()
        loc = make_location(alice)

        r = client.get(f"/locations/{loc['id']}", headers=bob)
        assert r.status_code == 404

        r = client.get("/locations/", headers=bob)
        assert r.json() == []

    def test_cannot_touch_other_users_session(
        self, client, make_user, make_location, make_session
    ):
        alice = make_user()
        bob = make_user()
        loc = make_location(alice)
        session = make_session(alice, loc["id"])

        assert client.get(f"/sessions/{session['id']}", headers=bob).status_code == 404
        assert client.delete(f"/sessions/{session['id']}", headers=bob).status_code == 404
        r = client.patch(
            f"/sessions/{session['id']}", json={"status": "cancelled"}, headers=bob
        )
        assert r.status_code == 404

    def test_ics_export_only_contains_own_sessions(
        self, client, make_user, make_location, make_session
    ):
        alice = make_user()
        bob = make_user()
        alice_loc = make_location(alice)
        make_session(alice, alice_loc["id"], target_name="Alice Secret Target")

        r = client.get("/planner/ics", headers=bob)
        assert r.status_code == 200
        assert "Alice Secret Target" not in r.text

        r = client.get("/planner/ics", headers=alice)
        assert "Alice Secret Target" in r.text


class TestLocations:
    def test_create_requires_coordinates(self, client, make_user):
        headers = make_user()
        r = client.post("/locations/", json={"name": "NoCoords"}, headers=headers)
        assert r.status_code == 422

    def test_out_of_range_coordinates_rejected(self, client, make_user):
        headers = make_user()
        r = client.post(
            "/locations/",
            json={"name": "Bad", "latitude": 123.0, "longitude": 0.0},
            headers=headers,
        )
        assert r.status_code == 422


class TestSessions:
    def test_local_time_converted_to_utc(self, client, make_user, make_location, make_session):
        headers = make_user()
        loc = make_location(headers)  # America/Toronto (UTC-4 in August)
        session = make_session(headers, loc["id"], scheduled_start_local="2026-08-01T23:00")
        assert session["scheduled_start"].startswith("2026-08-02T03:00")

    def test_invalid_timezone_rejected(self, client, make_user, make_location):
        headers = make_user()
        loc = make_location(headers, timezone=None)
        r = client.post(
            "/sessions/",
            json={
                "target_name": "Saturn",
                "location_id": loc["id"],
                "scheduled_start_local": "2026-08-01T23:00",
                "tz": "Not/AZone",
            },
            headers=headers,
        )
        assert r.status_code == 400

    def test_night_info(self, client, make_user, make_location):
        headers = make_user()
        loc = make_location(headers)
        r = client.get(
            "/targets/night",
            params={
                "location_id": loc["id"],
                "date_local": "2026-08-01",
                "tz": "America/Toronto",
            },
            headers=headers,
        )
        assert r.status_code == 200
        data = r.json()
        # Toronto in August has a real darkness window
        assert data["sunset"] and data["sunrise"]
        assert data["dark_start"] and data["dark_end"]
        assert 0.0 <= data["moon_illumination"] <= 1.0

    def test_night_info_rejects_bad_input(self, client, make_user, make_location):
        headers = make_user()
        loc = make_location(headers)
        r = client.get(
            "/targets/night",
            params={"location_id": loc["id"], "date_local": "not-a-date", "tz": "America/Toronto"},
            headers=headers,
        )
        assert r.status_code == 400

        r = client.get(
            "/targets/night",
            params={"location_id": loc["id"], "date_local": "2026-08-01", "tz": "Not/AZone"},
            headers=headers,
        )
        assert r.status_code == 400

    def test_night_info_isolated_per_user(self, client, make_user, make_location):
        alice = make_user()
        bob = make_user()
        loc = make_location(alice)
        r = client.get(
            "/targets/night",
            params={"location_id": loc["id"], "date_local": "2026-08-01", "tz": "America/Toronto"},
            headers=bob,
        )
        assert r.status_code == 404

    def test_visible_targets(self, client, make_user, make_location):
        headers = make_user()
        loc = make_location(headers)
        r = client.get(
            "/targets/visible",
            params={
                "location_id": loc["id"],
                "when_local": "2026-08-01T23:00",
                "tz": "America/Toronto",
            },
            headers=headers,
        )
        assert r.status_code == 200
        names = {t["name"] for t in r.json()}
        assert "Saturn" in names and "Moon" in names
