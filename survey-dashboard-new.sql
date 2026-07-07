--
-- PostgreSQL database dump
--

\restrict bjR7wIw59KgaOr6e3gLyULKMublmVfMmSxwdecgUHQlF711safsQixRB9hLkEVm

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-07-07 16:00:20

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
-- TOC entry 219 (class 1259 OID 75539)
-- Name: answers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.answers (
    id integer NOT NULL,
    response_id integer,
    question_id integer,
    answer_text text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.answers OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 75546)
-- Name: answers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.answers_id_seq OWNER TO postgres;

--
-- TOC entry 5133 (class 0 OID 0)
-- Dependencies: 220
-- Name: answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.answers_id_seq OWNED BY public.answers.id;


--
-- TOC entry 221 (class 1259 OID 75547)
-- Name: question_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.question_options (
    id integer NOT NULL,
    question_id integer,
    option_text character varying(255),
    "order" integer,
    next_question integer,
    media_url character varying(1000),
    score integer DEFAULT 0,
    is_red_flag boolean DEFAULT false
);


ALTER TABLE public.question_options OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 75555)
-- Name: question_options_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.question_options_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.question_options_id_seq OWNER TO postgres;

--
-- TOC entry 5134 (class 0 OID 0)
-- Dependencies: 222
-- Name: question_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.question_options_id_seq OWNED BY public.question_options.id;


--
-- TOC entry 223 (class 1259 OID 75556)
-- Name: questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.questions (
    id integer NOT NULL,
    survey_id integer,
    question_text character varying(500),
    question_type character varying(50),
    required boolean,
    "order" integer,
    created_at timestamp without time zone DEFAULT now(),
    media_type character varying(20) DEFAULT 'none'::character varying,
    media_url character varying(1000),
    rating_max integer DEFAULT 5,
    low_label character varying(100),
    high_label character varying(100),
    scale character varying(100),
    score_threshold integer,
    threshold_next_question integer
);


ALTER TABLE public.questions OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 75565)
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.questions_id_seq OWNER TO postgres;

--
-- TOC entry 5135 (class 0 OID 0)
-- Dependencies: 224
-- Name: questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.questions_id_seq OWNED BY public.questions.id;


--
-- TOC entry 225 (class 1259 OID 75566)
-- Name: responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.responses (
    id integer NOT NULL,
    survey_id integer,
    respondent_email character varying(255),
    completed_at timestamp without time zone DEFAULT now(),
    is_completed boolean,
    status character varying(50) DEFAULT 'Pending'::character varying
);


ALTER TABLE public.responses OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 75572)
-- Name: responses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.responses_id_seq OWNER TO postgres;

--
-- TOC entry 5136 (class 0 OID 0)
-- Dependencies: 226
-- Name: responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.responses_id_seq OWNED BY public.responses.id;


--
-- TOC entry 227 (class 1259 OID 75573)
-- Name: survey_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey_assignments (
    survey_id integer NOT NULL,
    group_id integer NOT NULL
);


ALTER TABLE public.survey_assignments OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 75578)
-- Name: surveys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.surveys (
    id integer NOT NULL,
    title character varying(255),
    description text,
    category character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_active boolean
);


ALTER TABLE public.surveys OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 75586)
-- Name: surveys_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.surveys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.surveys_id_seq OWNER TO postgres;

--
-- TOC entry 5137 (class 0 OID 0)
-- Dependencies: 229
-- Name: surveys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.surveys_id_seq OWNED BY public.surveys.id;


--
-- TOC entry 230 (class 1259 OID 75587)
-- Name: user_group_membership; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_group_membership (
    user_id integer NOT NULL,
    group_id integer NOT NULL
);


ALTER TABLE public.user_group_membership OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 75592)
-- Name: user_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_groups (
    id integer NOT NULL,
    name character varying(100),
    description text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_groups OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 75599)
-- Name: user_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_groups_id_seq OWNER TO postgres;

--
-- TOC entry 5138 (class 0 OID 0)
-- Dependencies: 232
-- Name: user_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_groups_id_seq OWNED BY public.user_groups.id;


--
-- TOC entry 233 (class 1259 OID 75600)
-- Name: user_survey_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_survey_assignments (
    user_id integer NOT NULL,
    survey_id integer NOT NULL
);


ALTER TABLE public.user_survey_assignments OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 75605)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50),
    is_first_login boolean,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 75613)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5139 (class 0 OID 0)
-- Dependencies: 235
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4898 (class 2604 OID 75614)
-- Name: answers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.answers ALTER COLUMN id SET DEFAULT nextval('public.answers_id_seq'::regclass);


--
-- TOC entry 4900 (class 2604 OID 75615)
-- Name: question_options id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.question_options ALTER COLUMN id SET DEFAULT nextval('public.question_options_id_seq'::regclass);


--
-- TOC entry 4903 (class 2604 OID 75616)
-- Name: questions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions ALTER COLUMN id SET DEFAULT nextval('public.questions_id_seq'::regclass);


--
-- TOC entry 4907 (class 2604 OID 75617)
-- Name: responses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.responses ALTER COLUMN id SET DEFAULT nextval('public.responses_id_seq'::regclass);


--
-- TOC entry 4910 (class 2604 OID 75618)
-- Name: surveys id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surveys ALTER COLUMN id SET DEFAULT nextval('public.surveys_id_seq'::regclass);


--
-- TOC entry 4913 (class 2604 OID 75619)
-- Name: user_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups ALTER COLUMN id SET DEFAULT nextval('public.user_groups_id_seq'::regclass);


--
-- TOC entry 4915 (class 2604 OID 75620)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5111 (class 0 OID 75539)
-- Dependencies: 219
-- Data for Name: answers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.answers (id, response_id, question_id, answer_text, created_at) FROM stdin;
33	5	25	no	2026-04-30 15:19:03.150727
34	5	26	weekly	2026-04-30 15:19:03.150727
35	5	27	gemini	2026-04-30 15:19:03.150727
36	5	28	["desgin"]	2026-04-30 15:19:03.150727
37	5	29	5	2026-04-30 15:19:03.150727
38	5	30	maybe	2026-04-30 15:19:03.150727
39	5	31	yes	2026-04-30 15:19:03.150727
40	5	32	yes	2026-04-30 15:19:03.150727
41	5	33	no	2026-04-30 15:19:03.150727
42	5	34	fffffffffffffffffffffffffffffffffffffffffffffsssssssssssssssssssssssssssssssssssssssssssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaazzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz	2026-04-30 15:19:03.150727
43	6	35	no	2026-04-30 15:20:21.490029
44	6	36	yes	2026-04-30 15:20:21.490029
45	6	37	Deep learning	2026-04-30 15:20:21.490029
46	6	38	python	2026-04-30 15:20:21.490029
47	6	39	yes	2026-04-30 15:20:21.490029
48	6	40	4	2026-04-30 15:20:21.490029
49	6	41	yes	2026-04-30 15:20:21.490029
50	6	42	mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm	2026-04-30 15:20:21.490029
51	6	43	no	2026-04-30 15:20:21.490029
52	6	44	robotics	2026-04-30 15:20:21.490029
53	7	45	yes 	2026-04-30 15:22:35.73808
54	7	46	wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwddddddd	2026-04-30 15:22:35.73808
55	7	47	courses	2026-04-30 15:22:35.73808
56	7	48	["js","css","html","react"]	2026-04-30 15:22:35.73808
57	7	49	4	2026-04-30 15:22:35.73808
58	7	50	no	2026-04-30 15:22:35.73808
59	7	51	yes 	2026-04-30 15:22:35.73808
60	7	52	5	2026-04-30 15:22:35.73808
61	7	53	no	2026-04-30 15:22:35.73808
62	7	54	wwwcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccczzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffbbbbbbbbbbbbbbbbgrgwwwwwwwwwwwwwwwwwwwwwc 	2026-04-30 15:22:35.73808
\.


--
-- TOC entry 5113 (class 0 OID 75547)
-- Dependencies: 221
-- Data for Name: question_options; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.question_options (id, question_id, option_text, "order", next_question, media_url, score, is_red_flag) FROM stdin;
800	508	Yes	0	\N		0	f
801	508	No	1	\N		0	f
802	509	Yes	0	\N		0	f
803	509	No	1	\N		0	f
804	510	Mobile	0	\N		0	f
805	510	Laptop	1	\N		0	f
806	510	Desktop	2	\N		0	f
807	510	Tablet	3	\N		0	f
808	511	<1 hour	0	\N		0	f
809	511	1-3 hours	1	\N		0	f
810	511	3-5 hours	2	\N		0	f
811	511	>5 hours	3	\N		0	f
812	512	Android	0	\N		0	f
813	512	iOS	1	\N		0	f
814	512	Windows	2	\N		0	f
815	512	macOS	3	\N		0	f
816	512	Linux	4	\N		0	f
817	513	Yes	0	\N		0	f
818	513	No	1	\N		0	f
819	514	Yes	0	\N		0	f
33	25	yes	0	\N	\N	0	f
34	25	no	0	\N	\N	0	f
35	26	daily	0	\N	\N	0	f
36	26	weekly	0	\N	\N	0	f
37	26	monthly	0	\N	\N	0	f
38	26	rarely	0	\N	\N	0	f
39	27	chatgpt 	0	\N	\N	0	f
40	27	gemini	0	\N	\N	0	f
41	27	copilte	0	\N	\N	0	f
42	27	others	0	\N	\N	0	f
43	28	study	0	\N	\N	0	f
44	28	codeing	0	\N	\N	0	f
45	28	desgin	0	\N	\N	0	f
46	28	writing	0	\N	\N	0	f
47	28	fun	0	\N	\N	0	f
48	30	yes	0	\N	\N	0	f
49	30	no	0	\N	\N	0	f
50	30	maybe	0	\N	\N	0	f
51	31	yes	0	\N	\N	0	f
52	31	no	0	\N	\N	0	f
53	32	yes	0	\N	\N	0	f
54	32	no	0	\N	\N	0	f
55	33	yes	0	\N	\N	0	f
56	33	no	0	\N	\N	0	f
57	35	yes	0	\N	\N	0	f
58	35	no	0	\N	\N	0	f
59	36	yes	0	\N	\N	0	f
60	36	no	0	\N	\N	0	f
61	37	LLM	0	\N	\N	0	f
62	37	NPL	0	\N	\N	0	f
63	37	Deep learning	0	\N	\N	0	f
64	37	none 	0	\N	\N	0	f
65	38	python	0	\N	\N	0	f
66	38	java	0	\N	\N	0	f
67	38	R	0	\N	\N	0	f
68	38	none	0	\N	\N	0	f
69	39	yes	0	\N	\N	0	f
70	39	no	0	\N	\N	0	f
71	41	yes	0	\N	\N	0	f
72	41	no 	0	\N	\N	0	f
73	41	may be	0	\N	\N	0	f
74	43	yes	0	\N	\N	0	f
75	43	no	0	\N	\N	0	f
76	44	robotics	0	\N	\N	0	f
77	44	chatbox	0	\N	\N	0	f
78	44	vision	0	\N	\N	0	f
79	44	automation	0	\N	\N	0	f
80	45	yes 	0	\N	\N	0	f
81	45	no	0	\N	\N	0	f
82	47	college	0	\N	\N	0	f
83	47	youtube	0	\N	\N	0	f
84	47	courses	0	\N	\N	0	f
85	47	self learning	0	\N	\N	0	f
86	47	others	0	\N	\N	0	f
87	48	html	0	\N	\N	0	f
88	48	css	0	\N	\N	0	f
89	48	js	0	\N	\N	0	f
90	48	react	0	\N	\N	0	f
91	48	angular	0	\N	\N	0	f
92	48	vue	0	\N	\N	0	f
93	50	yes	0	\N	\N	0	f
94	50	no	0	\N	\N	0	f
95	51	yes 	0	\N	\N	0	f
96	51	no	0	\N	\N	0	f
97	53	yes	0	\N	\N	0	f
98	53	no	0	\N	\N	0	f
147	75	yes	0	\N	\N	0	f
148	75	no	0	\N	\N	0	f
149	75	may be 	0	\N	\N	0	f
150	77	yes	0	\N	\N	0	f
151	77	no	0	\N	\N	0	f
152	79	yes	0	\N	\N	0	f
153	79	no	0	\N	\N	0	f
154	81	yes	0	\N	\N	0	f
155	81	no	0	\N	\N	0	f
156	81	may be	0	\N	\N	0	f
157	82	yes 	0	\N	\N	0	f
158	82	no	0	\N	\N	0	f
159	83	yes	0	\N	\N	0	f
160	83	no	0	\N	\N	0	f
161	83	may  be	0	\N	\N	0	f
162	85	yes	0	\N	\N	0	f
163	85	no	0	\N	\N	0	f
164	87	college	0	\N	\N	0	f
165	87	work	0	\N	\N	0	f
166	87	online 	0	\N	\N	0	f
167	87	self learning	0	\N	\N	0	f
168	88	docker	0	\N	\N	0	f
169	88	kubernetens	0	\N	\N	0	f
170	88	jenkins	0	\N	\N	0	f
171	88	git	0	\N	\N	0	f
172	90	yes 	0	\N	\N	0	f
173	90	no	0	\N	\N	0	f
174	93	yes 	0	\N	\N	0	f
175	93	no	0	\N	\N	0	f
820	514	No	1	\N		0	f
821	515	WhatsApp	0	\N		0	f
822	515	Facebook	1	\N		0	f
823	515	Instagram	2	\N		0	f
824	515	YouTube	3	\N		0	f
825	515	X	4	\N		0	f
826	516	Yes	0	\N		0	f
827	516	No	1	\N		0	f
828	518	Yes	0	\N		0	f
829	518	No	1	\N		0	f
830	519	Yes	0	\N		0	f
831	519	No	1	\N		0	f
832	520	Always	0	\N		0	f
833	520	Sometimes	1	\N		0	f
834	520	Rarely	2	\N		0	f
835	520	Never	3	\N		0	f
836	521	Yes	0	\N		0	f
659	425	Kannada	4	\N		0	f
660	425	Malayalam	5	\N		0	f
661	426	Yes	0	\N		0	f
662	426	No	1	\N		0	f
663	426	Maybe	2	\N		0	f
664	430	Yes	0	\N		0	f
665	430	No	1	\N		0	f
666	431	Yes	0	\N		0	f
667	431	No	1	\N		0	f
837	521	No	1	\N		0	f
838	522	Yes	0	\N		0	f
839	522	No	1	\N		0	f
840	523	Yes	0	\N		0	f
841	523	No	1	\N		0	f
842	525	Yes	0	\N		0	f
843	525	No	1	\N		0	f
844	528	ஆம்	0	\N		0	f
845	528	இல்லை	1	\N		0	f
846	529	ஆம்	0	\N		0	f
847	529	இல்லை	1	\N		0	f
848	530	மொபைல்	0	\N		0	f
849	530	மடிக்கணினி	1	\N		0	f
850	530	டெஸ்க்டாப்	2	\N		0	f
851	530	டேப்லெட்	3	\N		0	f
852	531	<1 மணிநேரம்	0	\N		0	f
853	531	1-3 மணி நேரம்	1	\N		0	f
854	531	3-5 மணி நேரம்	2	\N		0	f
855	531	> 5 மணி நேரம்	3	\N		0	f
856	532	அண்ட்ராய்டு	0	\N		0	f
857	532	iOS	1	\N		0	f
858	532	விண்டோஸ்	2	\N		0	f
380	271	html	0	\N	\N	0	f
381	271	css	0	\N	\N	0	f
382	271	js	0	\N	\N	0	f
383	271	react	0	\N	\N	0	f
384	272	react	0	\N	\N	0	f
385	272	angular	0	\N	\N	0	f
386	272	vue	0	\N	\N	0	f
387	272	none	0	\N	\N	0	f
388	273	yes	0	\N	\N	0	f
389	273	no	0	\N	\N	0	f
390	274	vscode	0	\N	\N	0	f
391	274	webstrom	0	\N	\N	0	f
392	274	sublime	0	\N	\N	0	f
393	274	others	0	\N	\N	0	f
394	276	yes	0	\N	\N	0	f
395	276	no	0	\N	\N	0	f
396	277	bootstrap	0	\N	\N	0	f
397	277	tailwind	0	\N	\N	0	f
398	277	material ui	0	\N	\N	0	f
399	277		0	\N	\N	0	f
400	278	yes	0	\N	\N	0	f
401	278	no	0	\N	\N	0	f
402	279	yes	0	\N	\N	0	f
403	279	no	0	\N	\N	0	f
859	532	macOS	3	\N		0	f
860	532	லினக்ஸ்	4	\N		0	f
861	533	ஆம்	0	\N		0	f
862	533	இல்லை	1	\N		0	f
863	534	ஆம்	0	\N		0	f
864	534	இல்லை	1	\N		0	f
865	535	வாட்ஸ்அப்	0	\N		0	f
866	535	Facebook	1	\N		0	f
867	535	Instagram	2	\N		0	f
868	535	YouTube	3	\N		0	f
869	535	எக்ஸ்	4	\N		0	f
870	536	ஆம்	0	\N		0	f
871	536	இல்லை	1	\N		0	f
872	538	ஆம்	0	\N		0	f
873	538	இல்லை	1	\N		0	f
533	356	one 	0	\N		1	f
534	356	two	1	\N		2	f
535	356	three	2	\N		0	f
536	357	one	0	\N		1	f
537	357	two	1	\N		2	f
538	357	three	2	\N		3	f
539	358	one	0	\N		1	f
540	358	two	1	\N		2	f
541	358	three	2	\N		3	f
195	105	yes	0	\N	\N	0	f
196	105	no	0	\N	\N	0	f
197	106	yes	0	\N	\N	0	f
198	106	no	0	\N	\N	0	f
199	107	Terraform	0	\N	\N	0	f
200	107	Ansible	0	\N	\N	0	f
201	108	yes	0	\N	\N	0	f
202	108	no	0	\N	\N	0	f
203	109	yes	0	\N	\N	0	f
204	109	no	0	\N	\N	0	f
205	111	yes	0	\N	\N	0	f
206	111	no	0	\N	\N	0	f
207	112	yes	0	\N	\N	0	f
208	112	no	0	\N	\N	0	f
209	113	yes	0	\N	\N	0	f
210	113	no	0	\N	\N	0	f
874	539	ஆம்	0	\N		0	f
875	539	இல்லை	1	\N		0	f
876	540	எப்போதும்	0	\N		0	f
877	540	சில சமயம்	1	\N		0	f
878	540	அரிதாக	2	\N		0	f
879	540	ஒருபோதும் இல்லை	3	\N		0	f
624	412	Male	0	\N		0	f
625	412	Female	1	\N		0	f
626	412	Other	2	\N		0	f
627	412	Prefer not to say	3	\N		0	f
628	414	High School	0	\N		0	f
629	414	Diploma	1	\N		0	f
630	414	Undergraduate	2	\N		0	f
631	414	Postgraduate	3	\N		0	f
632	414	PhD	4	\N		0	f
633	416	Yes	0	\N		0	f
634	416	No	1	\N		0	f
635	417	Friend	0	\N		0	f
636	417	Social Media	1	\N		0	f
637	417	Website	2	\N		0	f
638	417	Advertisement	3	\N		0	f
639	417	Other	4	\N		0	f
640	418	Chat	0	\N		0	f
641	418	Image Generation	1	\N		0	f
642	418	Translation	2	\N		0	f
643	418	OCR	3	\N		0	f
644	418	Search	4	\N		0	f
645	419	Daily	0	\N		0	f
646	419	Weekly	1	\N		0	f
647	419	Monthly	2	\N		0	f
648	419	Rarely	3	\N		0	f
649	420	Mobile	0	\N		0	f
650	420	Laptop	1	\N		0	f
651	420	Desktop	2	\N		0	f
652	420	Tablet	3	\N		0	f
653	423	Yes	0	\N		0	f
654	423	No	1	\N		0	f
655	425	English	0	\N		0	f
656	425	Tamil	1	\N		0	f
657	425	Hindi	2	\N		0	f
658	425	Telugu	3	\N		0	f
880	541	ஆம்	0	\N		0	f
881	541	இல்லை	1	\N		0	f
882	542	ஆம்	0	\N		0	f
883	542	இல்லை	1	\N		0	f
884	543	ஆம்	0	\N		0	f
885	543	இல்லை	1	\N		0	f
886	545	ஆம்	0	\N		0	f
887	545	இல்லை	1	\N		0	f
888	548	हाँ	0	\N		0	f
889	548	नहीं	1	\N		0	f
890	549	हाँ	0	\N		0	f
891	549	नहीं	1	\N		0	f
892	550	गतिमान	0	\N		0	f
893	550	लैपटॉप	1	\N		0	f
894	550	डेस्कटॉप	2	\N		0	f
895	550	गोली	3	\N		0	f
896	551	<1 घंटा	0	\N		0	f
897	551	1-3 घंटे	1	\N		0	f
898	551	3-5 घंटे	2	\N		0	f
899	551	>5 घंटे	3	\N		0	f
900	552	एंड्रॉइड	0	\N		0	f
901	552	आईओएस	1	\N		0	f
902	552	खिड़कियाँ	2	\N		0	f
903	552	मैक ओएस	3	\N		0	f
904	552	लिनक्स	4	\N		0	f
905	553	हाँ	0	\N		0	f
906	553	नहीं	1	\N		0	f
907	554	हाँ	0	\N		0	f
908	554	नहीं	1	\N		0	f
909	555	WhatsApp	0	\N		0	f
910	555	फेसबुक	1	\N		0	f
911	555	Instagram	2	\N		0	f
912	555	यूट्यूब	3	\N		0	f
913	555	एक्स	4	\N		0	f
914	556	हाँ	0	\N		0	f
915	556	नहीं	1	\N		0	f
916	558	हाँ	0	\N		0	f
917	558	नहीं	1	\N		0	f
918	559	हाँ	0	\N		0	f
919	559	नहीं	1	\N		0	f
920	560	हमेशा	0	\N		0	f
921	560	कभी-कभी	1	\N		0	f
922	560	कभी-कभार	2	\N		0	f
923	560	कभी नहीं	3	\N		0	f
924	561	हाँ	0	\N		0	f
925	561	नहीं	1	\N		0	f
926	562	हाँ	0	\N		0	f
927	562	नहीं	1	\N		0	f
928	563	हाँ	0	\N		0	f
929	563	नहीं	1	\N		0	f
930	565	हाँ	0	\N		0	f
931	565	नहीं	1	\N		0	f
\.


--
-- TOC entry 5115 (class 0 OID 75556)
-- Dependencies: 223
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.questions (id, survey_id, question_text, question_type, required, "order", created_at, media_type, media_url, rating_max, low_label, high_label, scale, score_threshold, threshold_next_question) FROM stdin;
344	39		text	t	0	2026-05-12 17:27:45.970708	none		5	\N	\N		\N	\N
408	53	Please enter your full name.	text	t	0	2026-07-06 16:00:29.38325	none		5				\N	\N
25	14	Do you use AI tools?	radio	t	0	2026-04-24 09:59:27.209883	none		5	\N	\N	\N	\N	\N
26	14	How often do you use AI?	radio	t	1	2026-04-24 09:59:27.209883	none		5	\N	\N	\N	\N	\N
27	14	Which AI tools do you use?	radio	t	2	2026-04-24 09:59:27.209883	none		5	\N	\N	\N	\N	\N
28	14	What do you use AI for?	checkbox	t	3	2026-04-24 09:59:27.209883	none		5	\N	\N	\N	\N	\N
29	14	Rate your experience with AI tools	rating	t	4	2026-04-24 09:59:27.209883	none		5	\N	\N	\N	\N	\N
30	14	Do you trust AI results?	radio	t	5	2026-04-24 09:59:27.209883	none		5	\N	\N	\N	\N	\N
31	14	Has AI improved your work speed?	radio	t	6	2026-04-24 09:59:27.209883	none		5	\N	\N	\N	\N	\N
32	14	Have you used voice assistants?	radio	t	7	2026-04-24 09:59:27.209883	none		5	\N	\N	\N	\N	\N
33	14	Do you prefer AI over manual work?	radio	t	8	2026-04-24 09:59:27.209883	none		5	\N	\N	\N	\N	\N
34	14	Describe your experience using AI	long_text	t	9	2026-04-24 09:59:27.209883	none		5	\N	\N	\N	\N	\N
35	15	Do you know how AI works?	radio	t	0	2026-04-24 10:06:28.707665	none		5	\N	\N	\N	\N	\N
36	15	Have you heard of Machine Learning?	radio	t	1	2026-04-24 10:06:28.707665	none		5	\N	\N	\N	\N	\N
37	15	Which concepts do you know?	radio	t	2	2026-04-24 10:06:28.707665	none		5	\N	\N	\N	\N	\N
38	15	Do you know any AI programming language?	radio	t	3	2026-04-24 10:06:28.707665	none		5	\N	\N	\N	\N	\N
39	15	Have you built any AI project?	radio	t	4	2026-04-24 10:06:28.707665	none		5	\N	\N	\N	\N	\N
40	15	Rate your AI knowledge level	rating	t	5	2026-04-24 10:06:28.707665	none		5	\N	\N	\N	\N	\N
41	15	Do you think math is needed for AI?	radio	t	6	2026-04-24 10:06:28.707665	none		5	\N	\N	\N	\N	\N
42	15	What skills are needed for AI?	long_text	t	7	2026-04-24 10:06:28.707665	none		5	\N	\N	\N	\N	\N
43	15	Have you taken any AI course?	radio	t	8	2026-04-24 10:06:28.707665	none		5	\N	\N	\N	\N	\N
44	15	What AI topics interest you most?	radio	t	9	2026-04-24 10:06:28.707665	none		5	\N	\N	\N	\N	\N
45	16	Do you know frontend development?	radio	t	0	2026-04-24 10:20:00.433142	none		5	\N	\N	\N	\N	\N
46	16	What does a frontend developer do?	text	t	1	2026-04-24 10:20:00.433142	none		5	\N	\N	\N	\N	\N
47	16	Where did you learn frontend development?	radio	t	2	2026-04-24 10:20:00.433142	none		5	\N	\N	\N	\N	\N
48	16	Which technologies do you know?	checkbox	t	3	2026-04-24 10:20:00.433142	none		5	\N	\N	\N	\N	\N
49	16	Rate your frontend knowledge	rating	t	4	2026-04-24 10:20:00.433142	none		5	\N	\N	\N	\N	\N
50	16	Do you build UI websites?	radio	t	5	2026-04-24 10:20:00.433142	none		5	\N	\N	\N	\N	\N
51	16	Example of a frontend project you built	radio	t	6	2026-04-24 10:20:00.433142	none		5	\N	\N	\N	\N	\N
52	16	How confident are you in frontend?	rating	t	7	2026-04-24 10:20:00.433142	none		5	\N	\N	\N	\N	\N
53	16	Have you done any internship?	radio	t	8	2026-04-24 10:20:00.433142	none		5	\N	\N	\N	\N	\N
54	16	Why did you choose frontend?	long_text	t	9	2026-04-24 10:20:00.433142	none		5	\N	\N	\N	\N	\N
75	18	Is frontend easy to learn?	radio	t	0	2026-04-24 10:32:50.287051	none		5	\N	\N	\N	\N	\N
76	18	Biggest challenge in frontend?	long_text	t	1	2026-04-24 10:32:50.287051	none		5	\N	\N	\N	\N	\N
77	18	Do frameworks simplify work?	radio	t	2	2026-04-24 10:32:50.287051	none		5	\N	\N	\N	\N	\N
78	18	Is performance optimization important?	rating	t	3	2026-04-24 10:32:50.287051	none		5	\N	\N	\N	\N	\N
79	18	Do you prefer mobile-first design?	radio	t	4	2026-04-24 10:32:50.287051	none		5	\N	\N	\N	\N	\N
80	18	Is accessibility important?	rating	t	5	2026-04-24 10:32:50.287051	none		5	\N	\N	\N	\N	\N
81	18	Do you enjoy UI designing?	radio	t	6	2026-04-24 10:32:50.287051	none		5	\N	\N	\N	\N	\N
82	18	Is frontend stressful?	radio	t	7	2026-04-24 10:32:50.287051	none		5	\N	\N	\N	\N	\N
83	18	Should frontend dev learn backend?	radio	t	8	2026-04-24 10:32:50.287051	none		5	\N	\N	\N	\N	\N
84	18	Your opinion on frontend future	long_text	t	9	2026-04-24 10:32:50.287051	none		5	\N	\N	\N	\N	\N
85	19	Do you know DevOps?	radio	t	0	2026-04-24 10:41:21.110016	none		5	\N	\N	\N	\N	\N
86	19	What is DevOps?	text	t	1	2026-04-24 10:41:21.110016	none		5	\N	\N	\N	\N	\N
87	19	Where did you learn DevOps?	radio	t	2	2026-04-24 10:41:21.110016	none		5	\N	\N	\N	\N	\N
88	19	Which tools do you know?\n	radio	t	3	2026-04-24 10:41:21.110016	none		5	\N	\N	\N	\N	\N
89	19	Rate your DevOps knowledge	rating	t	4	2026-04-24 10:41:21.110016	none		5	\N	\N	\N	\N	\N
90	19	Do you understand CI/CD?	radio	t	5	2026-04-24 10:41:21.110016	none		5	\N	\N	\N	\N	\N
91	19	Example of DevOps usage	text	t	6	2026-04-24 10:41:21.110016	none		5	\N	\N	\N	\N	\N
92	19	How confident are you in DevOps?	rating	t	7	2026-04-24 10:41:21.110016	none		5	\N	\N	\N	\N	\N
93	19	Have you worked on DevOps projects?	radio	t	8	2026-04-24 10:41:21.110016	none		5	\N	\N	\N	\N	\N
94	19	Why choose DevOps?	long_text	t	9	2026-04-24 10:41:21.110016	none		5	\N	\N	\N	\N	\N
409	53	Please enter your mobile number.	text	t	1	2026-07-06 16:00:29.38325	none		5				\N	\N
410	53	Please enter your email address.	text	f	2	2026-07-06 16:00:29.38325	none		5				\N	\N
411	53	What is your age?	number	t	3	2026-07-06 16:00:29.38325	none		5				\N	\N
412	53	What is your gender?	radio	t	4	2026-07-06 16:00:29.38325	none		5				\N	\N
413	53	Which city do you live in?	text	t	5	2026-07-06 16:00:29.38325	none		5				\N	\N
414	53	What is your highest educational qualification?	dropdown	t	6	2026-07-06 16:00:29.38325	none		5				\N	\N
415	53	What is your occupation?	text	t	7	2026-07-06 16:00:29.38325	none		5				\N	\N
416	53	Have you used our application before?	radio	t	8	2026-07-06 16:00:29.38325	none		5				\N	\N
417	53	How did you hear about our application?	dropdown	f	9	2026-07-06 16:00:29.38325	none		5				\N	\N
105	21	Do you automate deployments?	radio	t	0	2026-04-24 10:59:12.468644	none		5	\N	\N	\N	\N	\N
106	21	Do you use Infrastructure as Code?	radio	t	1	2026-04-24 10:59:12.468644	none		5	\N	\N	\N	\N	\N
107	21	Which IaC tools do you know?	radio	t	2	2026-04-24 10:59:12.468644	none		5	\N	\N	\N	\N	\N
108	21	Do you manage containers?	radio	t	3	2026-04-24 10:59:12.468644	none		5	\N	\N	\N	\N	\N
109	21	Do you use version control?	radio	t	4	2026-04-24 10:59:12.468644	none		5	\N	\N	\N	\N	\N
110	21	Rate your troubleshooting skills	rating	t	5	2026-04-24 10:59:12.468644	none		5	\N	\N	\N	\N	\N
111	21	Do you handle production issues?	radio	t	6	2026-04-24 10:59:12.468644	none		5	\N	\N	\N	\N	\N
112	21	Do you ensure security?	radio	t	7	2026-04-24 10:59:12.468644	none		5	\N	\N	\N	\N	\N
113	21	Do you optimize performance?	radio	t	8	2026-04-24 10:59:12.468644	none		5	\N	\N	\N	\N	\N
114	21	Explain your workflow	long_text	t	9	2026-04-24 10:59:12.468644	none		5	\N	\N	\N	\N	\N
356	46	option 1	select	t	0	2026-05-18 16:11:04.994179	none		5				\N	\N
357	46	option2	select	t	1	2026-05-18 16:11:04.994179	none		5				\N	\N
358	46	option3	select	t	2	2026-05-18 16:11:04.994179	none		5			0,1,2	9	4
359	46	option 4	text	t	3	2026-05-18 16:11:04.994179	none		5				\N	\N
360	46	option 5	text	t	4	2026-05-18 16:11:04.994179	none		5				\N	\N
418	53	Which features do you use most?	checkbox	f	10	2026-07-06 16:00:29.38325	none		5				\N	\N
419	53	How often do you use the application?	radio	t	11	2026-07-06 16:00:29.38325	none		5				\N	\N
420	53	Which device do you mostly use?	radio	t	12	2026-07-06 16:00:29.38325	none		5				\N	\N
421	53	How easy is the application to use?	rating	t	13	2026-07-06 16:00:29.38325	none		5				\N	\N
422	53	How satisfied are you with the application performance?	rating	t	14	2026-07-06 16:00:29.38325	none		5				\N	\N
423	53	Have you experienced any bugs?	radio	t	15	2026-07-06 16:00:29.38325	none		5				\N	\N
424	53	If yes, what issue did you face?	long_text	f	16	2026-07-06 16:00:29.38325	none		5				\N	\N
425	53	Which language do you prefer?	dropdown	t	17	2026-07-06 16:00:29.38325	none		5				\N	\N
426	53	Would you recommend this application to others?	radio	t	18	2026-07-06 16:00:29.38325	none		5				\N	\N
427	53	Which feature would you like us to improve?	long_text	f	19	2026-07-06 16:00:29.38325	none		5				\N	\N
428	53	How would you rate the user interface?	rating	t	20	2026-07-06 16:00:29.38325	none		5				\N	\N
429	53	How would you rate the response speed?	rating	t	21	2026-07-06 16:00:29.38325	none		5				\N	\N
430	53	Was the information provided helpful?	radio	t	22	2026-07-06 16:00:29.38325	none		5				\N	\N
271	17	Which languages do you use?	checkbox	t	0	2026-04-30 15:25:25.728948	none		5	\N	\N	\N	\N	\N
272	17	Which framework do you use?	radio	t	1	2026-04-30 15:25:25.728948	none		5	\N	\N	\N	\N	\N
273	17	Do you use version control?	radio	t	2	2026-04-30 15:25:25.728948	none		5	\N	\N	\N	\N	\N
274	17	Which tool do you use for coding?	radio	t	3	2026-04-30 15:25:25.728948	none		5	\N	\N	\N	\N	\N
275	17	Rate your JavaScript skills	rating	t	4	2026-04-30 15:25:25.728948	none		5	\N	\N	\N	\N	\N
276	17	Do you know responsive design?	radio	t	5	2026-04-30 15:25:25.728948	none		5	\N	\N	\N	\N	\N
277	17	Do you use CSS frameworks?	radio	t	6	2026-04-30 15:25:25.728948	none		5	\N	\N	\N	\N	\N
278	17	Do you optimize performance?	radio	t	7	2026-04-30 15:25:25.728948	none		5	\N	\N	\N	\N	\N
279	17	Do you use APIs in frontend?	radio	t	8	2026-04-30 15:25:25.728948	none		5	\N	\N	\N	\N	\N
280	17	Describe your tech stack	long_text	t	9	2026-04-30 15:25:25.728948	none		5	\N	\N	\N	\N	\N
431	53	Would you like to receive future updates?	radio	f	23	2026-07-06 16:00:29.38325	none		5				\N	\N
432	53	Please provide any additional feedback or suggestions.	long_text	f	24	2026-07-06 16:00:29.38325	none		5				\N	\N
508	57	Do you own a smartphone?	radio	t	0	2026-07-06 16:21:03.886186	none		5				\N	\N
509	57	Do you have internet access at home?	radio	t	1	2026-07-06 16:21:03.886186	none		5				\N	\N
510	57	Which device do you use most?	dropdown	t	2	2026-07-06 16:21:03.886186	none		5				\N	\N
511	57	How many hours do you use the internet daily?	dropdown	t	3	2026-07-06 16:21:03.886186	none		5				\N	\N
512	57	Which operating system do you use?	dropdown	t	4	2026-07-06 16:21:03.886186	none		5				\N	\N
513	57	Do you use online banking?	radio	t	5	2026-07-06 16:21:03.886186	none		5				\N	\N
514	57	Do you shop online?	radio	t	6	2026-07-06 16:21:03.886186	none		5				\N	\N
515	57	Which social media platform do you use most?	dropdown	t	7	2026-07-06 16:21:03.886186	none		5				\N	\N
516	57	Have you taken any online courses?	radio	t	8	2026-07-06 16:21:03.886186	none		5				\N	\N
517	57	How would you rate your computer skills?	rating	t	9	2026-07-06 16:21:03.886186	none		5				\N	\N
518	57	Do you use cloud storage?	radio	t	10	2026-07-06 16:21:03.886186	none		5				\N	\N
519	57	Do you use antivirus software?	radio	t	11	2026-07-06 16:21:03.886186	none		5				\N	\N
520	57	How often do you update your devices?	dropdown	t	12	2026-07-06 16:21:03.886186	none		5				\N	\N
521	57	Have you experienced phishing or cyber fraud?	radio	t	13	2026-07-06 16:21:03.886186	none		5				\N	\N
522	57	Do you use strong passwords?	radio	t	14	2026-07-06 16:21:03.886186	none		5				\N	\N
523	57	Do you enable two-factor authentication?	radio	t	15	2026-07-06 16:21:03.886186	none		5				\N	\N
524	57	How satisfied are you with your internet speed?	rating	t	16	2026-07-06 16:21:03.886186	none		5				\N	\N
525	57	Would you attend free digital literacy training?	radio	t	17	2026-07-06 16:21:03.886186	none		5				\N	\N
526	57	What IT service is most needed in your area?	long_text	f	18	2026-07-06 16:21:03.886186	none		5				\N	\N
527	57	Any suggestions to improve digital services?	long_text	f	19	2026-07-06 16:21:03.886186	none		5				\N	\N
528	58	உங்களிடம் ஸ்மார்ட்போன் இருக்கிறதா?	radio	t	0	2026-07-06 16:21:03.99798	none		5				\N	\N
529	58	வீட்டில் இணைய வசதி உள்ளதா?	radio	t	1	2026-07-06 16:21:03.99798	none		5				\N	\N
530	58	எந்த சாதனத்தை நீங்கள் அதிகம் பயன்படுத்துகிறீர்கள்?	dropdown	t	2	2026-07-06 16:21:03.99798	none		5				\N	\N
531	58	தினமும் எத்தனை மணி நேரம் இணையத்தைப் பயன்படுத்துகிறீர்கள்?	dropdown	t	3	2026-07-06 16:21:03.99798	none		5				\N	\N
532	58	நீங்கள் எந்த இயங்குதளத்தைப் பயன்படுத்துகிறீர்கள்?	dropdown	t	4	2026-07-06 16:21:03.99798	none		5				\N	\N
533	58	நீங்கள் ஆன்லைன் வங்கியைப் பயன்படுத்துகிறீர்களா?	radio	t	5	2026-07-06 16:21:03.99798	none		5				\N	\N
534	58	நீங்கள் ஆன்லைனில் ஷாப்பிங் செய்கிறீர்களா?	radio	t	6	2026-07-06 16:21:03.99798	none		5				\N	\N
535	58	எந்த சமூக ஊடக தளத்தை நீங்கள் அதிகம் பயன்படுத்துகிறீர்கள்?	dropdown	t	7	2026-07-06 16:21:03.99798	none		5				\N	\N
536	58	நீங்கள் ஏதேனும் ஆன்லைன் படிப்புகளை எடுத்திருக்கிறீர்களா?	radio	t	8	2026-07-06 16:21:03.99798	none		5				\N	\N
537	58	உங்கள் கணினி திறன்களை எப்படி மதிப்பிடுவீர்கள்?	rating	t	9	2026-07-06 16:21:03.99798	none		5				\N	\N
538	58	நீங்கள் கிளவுட் சேமிப்பகத்தைப் பயன்படுத்துகிறீர்களா?	radio	t	10	2026-07-06 16:21:03.99798	none		5				\N	\N
539	58	நீங்கள் வைரஸ் தடுப்பு மென்பொருளைப் பயன்படுத்துகிறீர்களா?	radio	t	11	2026-07-06 16:21:03.99798	none		5				\N	\N
540	58	உங்கள் சாதனங்களை எத்தனை முறை புதுப்பிப்பீர்கள்?	dropdown	t	12	2026-07-06 16:21:03.99798	none		5				\N	\N
541	58	நீங்கள் ஃபிஷிங் அல்லது இணைய மோசடியை அனுபவித்திருக்கிறீர்களா?	radio	t	13	2026-07-06 16:21:03.99798	none		5				\N	\N
542	58	நீங்கள் வலுவான கடவுச்சொற்களைப் பயன்படுத்துகிறீர்களா?	radio	t	14	2026-07-06 16:21:03.99798	none		5				\N	\N
543	58	இரண்டு காரணி அங்கீகாரத்தை இயக்குகிறீர்களா?	radio	t	15	2026-07-06 16:21:03.99798	none		5				\N	\N
544	58	உங்கள் இணைய வேகத்தில் எவ்வளவு திருப்தியாக உள்ளீர்கள்?	rating	t	16	2026-07-06 16:21:03.99798	none		5				\N	\N
545	58	இலவச டிஜிட்டல் கல்வியறிவு பயிற்சியில் கலந்து கொள்வீர்களா?	radio	t	17	2026-07-06 16:21:03.99798	none		5				\N	\N
546	58	உங்கள் பகுதியில் மிகவும் தேவைப்படும் தகவல் தொழில்நுட்ப சேவை எது?	long_text	f	18	2026-07-06 16:21:03.99798	none		5				\N	\N
547	58	டிஜிட்டல் சேவைகளை மேம்படுத்த ஏதேனும் ஆலோசனைகள் உள்ளதா?	long_text	f	19	2026-07-06 16:21:03.99798	none		5				\N	\N
548	59	क्या आपके पास स्मार्टफोन है?	radio	t	0	2026-07-06 16:21:04.060721	none		5				\N	\N
549	59	क्या आपके घर पर इंटरनेट की सुविधा है?	radio	t	1	2026-07-06 16:21:04.060721	none		5				\N	\N
550	59	आप किस उपकरण का सबसे अधिक उपयोग करते हैं?	dropdown	t	2	2026-07-06 16:21:04.060721	none		5				\N	\N
551	59	आप प्रतिदिन कितने घंटे इंटरनेट का उपयोग करते हैं?	dropdown	t	3	2026-07-06 16:21:04.060721	none		5				\N	\N
552	59	आप कौन सा ऑपरेटिंग सिस्टम उपयोग करते हैं?	dropdown	t	4	2026-07-06 16:21:04.060721	none		5				\N	\N
553	59	क्या आप ऑनलाइन बैंकिंग का उपयोग करते हैं?	radio	t	5	2026-07-06 16:21:04.060721	none		5				\N	\N
554	59	क्या आप ऑनलाइन खरीदारी करते हैं?	radio	t	6	2026-07-06 16:21:04.060721	none		5				\N	\N
555	59	आप किस सोशल मीडिया प्लेटफॉर्म का सबसे ज्यादा इस्तेमाल करते हैं?	dropdown	t	7	2026-07-06 16:21:04.060721	none		5				\N	\N
556	59	क्या आपने कोई ऑनलाइन पाठ्यक्रम लिया है?	radio	t	8	2026-07-06 16:21:04.060721	none		5				\N	\N
557	59	आप अपने कंप्यूटर कौशल का मूल्यांकन कैसे करेंगे?	rating	t	9	2026-07-06 16:21:04.060721	none		5				\N	\N
558	59	क्या आप क्लाउड स्टोरेज का उपयोग करते हैं?	radio	t	10	2026-07-06 16:21:04.060721	none		5				\N	\N
559	59	क्या आप एंटीवायरस सॉफ़्टवेयर का उपयोग करते हैं?	radio	t	11	2026-07-06 16:21:04.060721	none		5				\N	\N
560	59	आप अपने डिवाइस को कितनी बार अपडेट करते हैं?	dropdown	t	12	2026-07-06 16:21:04.060721	none		5				\N	\N
561	59	क्या आपने फ़िशिंग या साइबर धोखाधड़ी का अनुभव किया है?	radio	t	13	2026-07-06 16:21:04.060721	none		5				\N	\N
562	59	क्या आप मजबूत पासवर्ड का उपयोग करते हैं?	radio	t	14	2026-07-06 16:21:04.060721	none		5				\N	\N
563	59	क्या आप दो-कारक प्रमाणीकरण सक्षम करते हैं?	radio	t	15	2026-07-06 16:21:04.060721	none		5				\N	\N
564	59	आप अपनी इंटरनेट स्पीड से कितने संतुष्ट हैं?	rating	t	16	2026-07-06 16:21:04.060721	none		5				\N	\N
565	59	क्या आप निःशुल्क डिजिटल साक्षरता प्रशिक्षण में भाग लेंगे?	radio	t	17	2026-07-06 16:21:04.060721	none		5				\N	\N
566	59	आपके क्षेत्र में किस आईटी सेवा की सबसे अधिक आवश्यकता है?	long_text	f	18	2026-07-06 16:21:04.060721	none		5				\N	\N
567	59	डिजिटल सेवाओं में सुधार के लिए कोई सुझाव?	long_text	f	19	2026-07-06 16:21:04.060721	none		5				\N	\N
\.


--
-- TOC entry 5117 (class 0 OID 75566)
-- Dependencies: 225
-- Data for Name: responses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.responses (id, survey_id, respondent_email, completed_at, is_completed, status) FROM stdin;
5	14	ai-user2@gmail.com	2026-04-30 15:19:03.144748	t	Pending
6	15	ai-user3@gmail.com	2026-04-30 15:20:21.484616	t	Pending
7	16	dev-user1@gmail.com	2026-04-30 15:22:35.734498	t	Pending
\.


--
-- TOC entry 5119 (class 0 OID 75573)
-- Dependencies: 227
-- Data for Name: survey_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey_assignments (survey_id, group_id) FROM stdin;
15	3
18	4
21	5
\.


--
-- TOC entry 5120 (class 0 OID 75578)
-- Dependencies: 228
-- Data for Name: surveys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.surveys (id, title, description, category, created_at, updated_at, is_active) FROM stdin;
14	AI-model2		AI	2026-04-24 09:59:27.170048	2026-04-24 09:59:27.170048	t
15	AI-model3		AI	2026-04-24 10:06:28.669088	2026-04-24 10:06:28.669088	t
16	dev-model1		Developer	2026-04-24 10:20:00.387782	2026-04-24 10:20:00.387782	t
17	dev-model2		Developer	2026-04-24 10:28:29.823117	2026-04-24 10:28:43.93076	t
18	dev-model3		Developer	2026-04-24 10:32:50.245551	2026-04-24 10:32:50.245551	t
19	ops-model1		DevOps	2026-04-24 10:41:21.068471	2026-04-24 10:41:21.068471	t
21	ops-model3		DevOps	2026-04-24 10:59:12.43179	2026-04-24 10:59:12.43179	t
27	dev-model 6		Developer	2026-05-04 17:12:50.265942	2026-05-04 17:12:50.265942	t
35	fitness		fitness	2026-05-12 17:10:15.055621	2026-05-12 17:10:15.055621	t
36	fitness		fitness	2026-05-12 17:10:16.526777	2026-05-12 17:10:16.526777	t
39	health		fitness	2026-05-12 17:27:45.944126	2026-05-12 17:27:45.944126	t
46	score tester		kuppam	2026-05-18 16:08:45.503525	2026-05-18 16:08:45.503525	t
53	Uploaded Survey		AI	2026-07-06 16:00:29.362334	2026-07-06 16:00:29.362334	t
57	model1	General IT Survey	kuppam	2026-07-06 16:21:03.865201	2026-07-06 16:21:03.865201	t
58	மாதிரி1 (Tamil)	பொது தகவல் தொழில்நுட்ப ஆய்வு	kuppam	2026-07-06 16:21:03.981587	2026-07-06 16:21:03.981587	t
59	मॉडल1 (Hindi)	सामान्य आईटी सर्वेक्षण	kuppam	2026-07-06 16:21:04.04404	2026-07-06 16:21:04.04404	t
\.


--
-- TOC entry 5122 (class 0 OID 75587)
-- Dependencies: 230
-- Data for Name: user_group_membership; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_group_membership (user_id, group_id) FROM stdin;
47	3
48	3
49	3
52	4
54	4
53	4
57	5
58	5
59	5
\.


--
-- TOC entry 5123 (class 0 OID 75592)
-- Dependencies: 231
-- Data for Name: user_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_groups (id, name, description, created_at) FROM stdin;
3	ai-team1	\N	2026-04-29 17:02:24.484537
4	dev-team1	\N	2026-04-30 14:58:17.450505
5	ops-team1	\N	2026-04-30 14:59:30.658184
\.


--
-- TOC entry 5125 (class 0 OID 75600)
-- Dependencies: 233
-- Data for Name: user_survey_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_survey_assignments (user_id, survey_id) FROM stdin;
61	15
62	16
63	19
46	14
50	16
55	19
51	16
68	46
\.


--
-- TOC entry 5126 (class 0 OID 75605)
-- Dependencies: 234
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, role, is_first_login, is_active, created_at, updated_at) FROM stdin;
68	babu	$5$rounds=535000$zIOX.HV6XGt49rn8$4qJwdrkCF5cr1ptM/KsW7vw0A9U417XQvhtfaHDGu0C	User	f	t	2026-05-11 10:05:57.7394	2026-05-11 10:06:32.783948
49	ai-user5	$5$rounds=535000$5Cu.CFXsPFDzwAPq$vcF6/THpyVOwc7ppQUQWH2HoWs6TKEGSpQMgM.VfW3D	User	f	t	2026-04-30 14:21:54.806509	2026-05-15 15:04:01.207672
55	ops-user1	$5$rounds=535000$ht8EeyBkW18JSBpn$TEHRE9QNSewMuqwvl5rQmV3l17/EcujavlEguDQMWjB	User	f	t	2026-04-30 14:30:13.786721	2026-05-15 17:46:53.616708
2	admin	$5$rounds=535000$lGdA1PV2a4TzyJUo$TeYd62SvMDBK/hLkHL2PdIp0JEXKvu0s/GQ0Gx0Q485	Admin	f	t	2026-04-22 12:28:20.684452	2026-04-29 15:10:11.559053
52	dev-user3	$5$rounds=535000$17YevPdJe949of5J$fWymIL15occR25pi3.D42c1sTygC7wyNwRq9JhrAxf7	User	t	t	2026-04-30 14:23:05.376504	2026-04-30 14:23:05.376504
53	dev-user4	$5$rounds=535000$l4JY.oUxqXbxVQUu$ztbjzce5p0CGjIbiV7hbvIEQIvrivaqFINK9Obdfto3	User	t	t	2026-04-30 14:26:19.071094	2026-04-30 14:26:19.071094
54	dev-user5	$5$rounds=535000$Zcx8IkEEsyzp3XnZ$gf8nrWQ5JJ9.CIPGVggGMr2pxBS9tXryUaXynaJIHn9	User	t	t	2026-04-30 14:26:26.299697	2026-04-30 14:26:26.299697
56	ops-user2	$5$rounds=535000$MOWEwucyYMSypgYw$pNoWSYoaWv4NEH.N/JP55wHR39gVlACwmNd1mluPvd6	User	t	t	2026-04-30 14:30:21.232233	2026-04-30 14:30:21.232233
57	ops-user3	$5$rounds=535000$ISmSYIASVtdEdugI$d1zoVpwj77J7dOGlL7ymcgF3PN1hzjfACpIwcw9Z4KD	User	t	t	2026-04-30 14:30:32.243926	2026-04-30 14:30:32.243926
58	ops-user4	$5$rounds=535000$vjWZRqQmOXinn9o9$BNpH2QnUCFF2wHe6iIjUfpJJLfEyb.l4C8si4tgQ1E0	User	t	t	2026-04-30 14:30:42.979707	2026-04-30 14:30:42.979707
59	ops-user5	$5$rounds=535000$YuLPzuqseexr9CAw$rXHeYbEO9URbEwYujicI5T1jTq6UDMtpFvBtY9LkRqD	User	t	t	2026-04-30 14:30:52.336149	2026-04-30 14:30:52.336149
61	test1	$5$rounds=535000$j1ECQkVejGuSliJt$5HgeIv8lzm0BK/5kKWb.s2fN91cOZ5rBc7XckIFvc6A	User	t	t	2026-04-30 14:44:29.16336	2026-04-30 14:44:29.16336
62	test2	$5$rounds=535000$d8jmdyoigDkM2dbs$ASNiO8R0wWboWQ.K.YVerXX134RGRH6V2HfO8dioyr8	User	t	t	2026-04-30 14:44:46.45476	2026-04-30 14:44:46.45476
63	test3	$5$rounds=535000$oq6KKIzMP0VsKT7C$SyFIG40Ni.pxghYmg58Hsr9yl.6x2j4Ia2yLm./GZO0	User	t	t	2026-04-30 14:44:59.284915	2026-04-30 14:44:59.284915
60	manager1	$5$rounds=535000$4pyU956mWzUCvXAm$hgCXPVuTPiFoMCzWY1E2Cr1L5dvzAcGXQbNbk91UsY.	Manager	f	t	2026-04-30 14:44:05.313727	2026-04-30 14:47:09.593071
64	test4	$5$rounds=535000$c16EH9JL0ls99AWz$q1nziox1j6xjXBCoUY/ROiuSQiwEmhqFMywALciLd11	User	t	t	2026-04-30 14:47:29.946509	2026-04-30 14:47:29.946509
45	ai-user1	$5$rounds=535000$7HU33YJNnDQDTSTB$iJ.HCGixnHbsJZY3J/Y.ZF3TU383oKU4alMBtPghtM8	User	f	t	2026-04-30 14:21:16.681612	2026-04-30 15:14:03.573922
46	ai-user2	$5$rounds=535000$t1fffrceWWOnEzRA$xHhjCgah.Aq4Xxpa55rgp4NPvLr3DZ1YQJX7Q5AIFK7	User	f	t	2026-04-30 14:21:33.176706	2026-04-30 15:18:08.516373
47	ai-user3	$5$rounds=535000$U9BZHjkFXoEcoEiZ$XakhBjpUXtLkTPecbO57tUEu4U.6EHOjmge27FRE3F5	User	f	t	2026-04-30 14:21:40.325467	2026-04-30 15:19:28.205582
50	dev-user1	$5$rounds=535000$iej5LG7W.0Z7jl8z$hpeU6.CQF5PdVNooVXX4ndt4.mAi.Bvqdr/jsVB9h9.	User	f	t	2026-04-30 14:22:54.34858	2026-04-30 15:21:43.446834
51	dev-user2	$5$rounds=535000$MoyXJRogvg5/Ri.x$Vd7KZ77IwED4LOJ9pZcu0GQ4FdkA7iH4DlVQ2HCxcW6	User	f	t	2026-04-30 14:23:00.639525	2026-04-30 15:23:02.079453
48	ai-user4	$5$rounds=535000$ySO.E1RfzN/JtuZN$XxOSR/JUBDzeBbUwSStWwM6Gvi.8./yp9oiPVB/g6Y/	User	f	t	2026-04-30 14:21:47.620456	2026-05-08 10:29:53.44869
66	testuser	$5$rounds=535000$9etyLwT3rGoIVy9V$1CVxuFUitJiXdUKvD65j4JFFaLv7hISUEkdxQK3moIC	User	f	t	2026-05-08 12:28:09.067358	2026-05-08 12:28:09.067358
\.


--
-- TOC entry 5140 (class 0 OID 0)
-- Dependencies: 220
-- Name: answers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.answers_id_seq', 62, true);


--
-- TOC entry 5141 (class 0 OID 0)
-- Dependencies: 222
-- Name: question_options_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.question_options_id_seq', 1111, true);


--
-- TOC entry 5142 (class 0 OID 0)
-- Dependencies: 224
-- Name: questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.questions_id_seq', 647, true);


--
-- TOC entry 5143 (class 0 OID 0)
-- Dependencies: 226
-- Name: responses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.responses_id_seq', 7, true);


--
-- TOC entry 5144 (class 0 OID 0)
-- Dependencies: 229
-- Name: surveys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.surveys_id_seq', 63, true);


--
-- TOC entry 5145 (class 0 OID 0)
-- Dependencies: 232
-- Name: user_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_groups_id_seq', 5, true);


--
-- TOC entry 5146 (class 0 OID 0)
-- Dependencies: 235
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 68, true);


--
-- TOC entry 4919 (class 2606 OID 75622)
-- Name: answers answers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_pkey PRIMARY KEY (id);


--
-- TOC entry 4926 (class 2606 OID 75624)
-- Name: question_options question_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_pkey PRIMARY KEY (id);


--
-- TOC entry 4930 (class 2606 OID 75626)
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- TOC entry 4934 (class 2606 OID 75628)
-- Name: responses responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_pkey PRIMARY KEY (id);


--
-- TOC entry 4936 (class 2606 OID 75630)
-- Name: survey_assignments survey_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_assignments
    ADD CONSTRAINT survey_assignments_pkey PRIMARY KEY (survey_id, group_id);


--
-- TOC entry 4940 (class 2606 OID 75632)
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- TOC entry 4942 (class 2606 OID 75634)
-- Name: user_group_membership user_group_membership_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_group_membership
    ADD CONSTRAINT user_group_membership_pkey PRIMARY KEY (user_id, group_id);


--
-- TOC entry 4946 (class 2606 OID 75636)
-- Name: user_groups user_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 4948 (class 2606 OID 75638)
-- Name: user_survey_assignments user_survey_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_survey_assignments
    ADD CONSTRAINT user_survey_assignments_pkey PRIMARY KEY (user_id, survey_id);


--
-- TOC entry 4952 (class 2606 OID 75640)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4920 (class 1259 OID 75641)
-- Name: ix_answers_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_answers_id ON public.answers USING btree (id);


--
-- TOC entry 4921 (class 1259 OID 75642)
-- Name: ix_answers_question_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_answers_question_id ON public.answers USING btree (question_id);


--
-- TOC entry 4922 (class 1259 OID 75643)
-- Name: ix_answers_response_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_answers_response_id ON public.answers USING btree (response_id);


--
-- TOC entry 4923 (class 1259 OID 75644)
-- Name: ix_question_options_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_question_options_id ON public.question_options USING btree (id);


--
-- TOC entry 4924 (class 1259 OID 75645)
-- Name: ix_question_options_question_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_question_options_question_id ON public.question_options USING btree (question_id);


--
-- TOC entry 4927 (class 1259 OID 75646)
-- Name: ix_questions_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_questions_id ON public.questions USING btree (id);


--
-- TOC entry 4928 (class 1259 OID 75647)
-- Name: ix_questions_survey_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_questions_survey_id ON public.questions USING btree (survey_id);


--
-- TOC entry 4931 (class 1259 OID 75648)
-- Name: ix_responses_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_responses_id ON public.responses USING btree (id);


--
-- TOC entry 4932 (class 1259 OID 75649)
-- Name: ix_responses_survey_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_responses_survey_id ON public.responses USING btree (survey_id);


--
-- TOC entry 4937 (class 1259 OID 75650)
-- Name: ix_surveys_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_surveys_id ON public.surveys USING btree (id);


--
-- TOC entry 4938 (class 1259 OID 75651)
-- Name: ix_surveys_title; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_surveys_title ON public.surveys USING btree (title);


--
-- TOC entry 4943 (class 1259 OID 75652)
-- Name: ix_user_groups_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_user_groups_id ON public.user_groups USING btree (id);


--
-- TOC entry 4944 (class 1259 OID 75653)
-- Name: ix_user_groups_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_user_groups_name ON public.user_groups USING btree (name);


--
-- TOC entry 4949 (class 1259 OID 75654)
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- TOC entry 4950 (class 1259 OID 75655)
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


--
-- TOC entry 4953 (class 2606 OID 75656)
-- Name: answers answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- TOC entry 4954 (class 2606 OID 75661)
-- Name: answers answers_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.responses(id) ON DELETE CASCADE;


--
-- TOC entry 4955 (class 2606 OID 75666)
-- Name: question_options question_options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.question_options
    ADD CONSTRAINT question_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- TOC entry 4956 (class 2606 OID 75671)
-- Name: questions questions_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- TOC entry 4957 (class 2606 OID 75676)
-- Name: responses responses_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- TOC entry 4958 (class 2606 OID 75681)
-- Name: survey_assignments survey_assignments_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_assignments
    ADD CONSTRAINT survey_assignments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.user_groups(id) ON DELETE CASCADE;


--
-- TOC entry 4959 (class 2606 OID 75686)
-- Name: survey_assignments survey_assignments_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_assignments
    ADD CONSTRAINT survey_assignments_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- TOC entry 4960 (class 2606 OID 75691)
-- Name: user_group_membership user_group_membership_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_group_membership
    ADD CONSTRAINT user_group_membership_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.user_groups(id) ON DELETE CASCADE;


--
-- TOC entry 4961 (class 2606 OID 75696)
-- Name: user_group_membership user_group_membership_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_group_membership
    ADD CONSTRAINT user_group_membership_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4962 (class 2606 OID 75701)
-- Name: user_survey_assignments user_survey_assignments_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_survey_assignments
    ADD CONSTRAINT user_survey_assignments_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- TOC entry 4963 (class 2606 OID 75706)
-- Name: user_survey_assignments user_survey_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_survey_assignments
    ADD CONSTRAINT user_survey_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


-- Completed on 2026-07-07 16:00:20

--
-- PostgreSQL database dump complete
--

\unrestrict bjR7wIw59KgaOr6e3gLyULKMublmVfMmSxwdecgUHQlF711safsQixRB9hLkEVm

