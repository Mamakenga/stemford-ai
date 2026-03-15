--
-- PostgreSQL database dump
--

\restrict mB7TwweGlswhqSb2J7mMptI8Hri3wtfdsTsQg9Fylv2xkyAIxxDrERaUStLQhAB

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.3 (Debian 18.3-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actions_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.actions_log (
    action_id text NOT NULL,
    action_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    actor_role text NOT NULL,
    run_id text,
    idempotency_key text,
    payload jsonb,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_requests (
    approval_id text NOT NULL,
    action_class text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    requested_by_role text NOT NULL,
    approver_role text NOT NULL,
    status text NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    decided_by_role text,
    CONSTRAINT approval_requests_action_class_check CHECK ((action_class = ANY (ARRAY['safe_read'::text, 'internal_write'::text, 'external_comm'::text, 'financial_change'::text, 'policy_change'::text]))),
    CONSTRAINT approval_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text])))
);


--
-- Name: goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goals (
    id text NOT NULL,
    parent_id text,
    stage text,
    title text NOT NULL,
    status text NOT NULL,
    kpi_name text,
    kpi_target text,
    due_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT goals_check CHECK ((id <> parent_id)),
    CONSTRAINT goals_stage_check CHECK ((stage = ANY (ARRAY['A'::text, 'B'::text, 'C'::text]))),
    CONSTRAINT goals_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'done'::text])))
);


--
-- Name: handoff_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handoff_policies (
    caller_role_id text NOT NULL,
    callee_role_id text NOT NULL,
    allowed boolean NOT NULL,
    notes text
);


--
-- Name: org_edges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_edges (
    manager_role_id text NOT NULL,
    child_role_id text NOT NULL,
    relation_type text NOT NULL,
    CONSTRAINT org_edges_relation_type_check CHECK ((relation_type = 'reports_to'::text))
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    role_id text NOT NULL,
    title text NOT NULL,
    domain text NOT NULL,
    status text NOT NULL,
    CONSTRAINT roles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: task_goal_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_goal_links (
    task_id text NOT NULL,
    goal_id text NOT NULL,
    link_type text NOT NULL,
    CONSTRAINT task_goal_links_link_type_check CHECK ((link_type = 'secondary'::text))
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id text NOT NULL,
    title text NOT NULL,
    primary_goal_id text NOT NULL,
    status text NOT NULL,
    assignee text NOT NULL,
    due_at timestamp with time zone,
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['backlog'::text, 'todo'::text, 'in_progress'::text, 'blocked'::text, 'done'::text, 'failed'::text])))
);


--
-- Name: actions_log actions_log_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actions_log
    ADD CONSTRAINT actions_log_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: actions_log actions_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.actions_log
    ADD CONSTRAINT actions_log_pkey PRIMARY KEY (action_id);


--
-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (approval_id);


--
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);


--
-- Name: handoff_policies handoff_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoff_policies
    ADD CONSTRAINT handoff_policies_pkey PRIMARY KEY (caller_role_id, callee_role_id);


--
-- Name: org_edges org_edges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_edges
    ADD CONSTRAINT org_edges_pkey PRIMARY KEY (manager_role_id, child_role_id, relation_type);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);


--
-- Name: task_goal_links task_goal_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_goal_links
    ADD CONSTRAINT task_goal_links_pkey PRIMARY KEY (task_id, goal_id, link_type);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: idx_actions_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_actions_timestamp ON public.actions_log USING btree ("timestamp");


--
-- Name: idx_approval_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_pending ON public.approval_requests USING btree (status, approver_role, created_at);


--
-- Name: idx_goals_stage_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_goals_stage_status ON public.goals USING btree (stage, status);


--
-- Name: idx_tasks_assignee_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assignee_status ON public.tasks USING btree (assignee, status);


--
-- Name: idx_tasks_due_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_due_at ON public.tasks USING btree (due_at);


--
-- Name: approval_requests approval_requests_approver_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_approver_role_fkey FOREIGN KEY (approver_role) REFERENCES public.roles(role_id);


--
-- Name: approval_requests approval_requests_decided_by_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_decided_by_role_fkey FOREIGN KEY (decided_by_role) REFERENCES public.roles(role_id);


--
-- Name: approval_requests approval_requests_requested_by_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_requested_by_role_fkey FOREIGN KEY (requested_by_role) REFERENCES public.roles(role_id);


--
-- Name: goals goals_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.goals(id);


--
-- Name: handoff_policies handoff_policies_callee_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoff_policies
    ADD CONSTRAINT handoff_policies_callee_role_id_fkey FOREIGN KEY (callee_role_id) REFERENCES public.roles(role_id);


--
-- Name: handoff_policies handoff_policies_caller_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handoff_policies
    ADD CONSTRAINT handoff_policies_caller_role_id_fkey FOREIGN KEY (caller_role_id) REFERENCES public.roles(role_id);


--
-- Name: org_edges org_edges_child_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_edges
    ADD CONSTRAINT org_edges_child_role_id_fkey FOREIGN KEY (child_role_id) REFERENCES public.roles(role_id);


--
-- Name: org_edges org_edges_manager_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_edges
    ADD CONSTRAINT org_edges_manager_role_id_fkey FOREIGN KEY (manager_role_id) REFERENCES public.roles(role_id);


--
-- Name: task_goal_links task_goal_links_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_goal_links
    ADD CONSTRAINT task_goal_links_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE;


--
-- Name: task_goal_links task_goal_links_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_goal_links
    ADD CONSTRAINT task_goal_links_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assignee_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assignee_fkey FOREIGN KEY (assignee) REFERENCES public.roles(role_id);


--
-- Name: tasks tasks_primary_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_primary_goal_id_fkey FOREIGN KEY (primary_goal_id) REFERENCES public.goals(id);


--
-- PostgreSQL database dump complete
--

\unrestrict mB7TwweGlswhqSb2J7mMptI8Hri3wtfdsTsQg9Fylv2xkyAIxxDrERaUStLQhAB

