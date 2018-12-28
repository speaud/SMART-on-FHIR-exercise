import React from 'react';
import ReactDOM from 'react-dom';
import {
	Grid,
	Segment,
	Dropdown,
	Card,
	Table,
	Icon
} from 'semantic-ui-react';

class FilterIcon extends React.PureComponent {
	render() {
		const { isDisabled, by, order, activeFilterState, onClickHandler } = this.props

		const inverseOrder = activeFilterState.order === 'asc' ? 'desc' : order

		return(
			<Icon
				name={activeFilterState.by != by ? 'arrows alternate vertical' : inverseOrder === 'asc' ? 'long arrow alternate down' : 'long arrow alternate up'}
				data-by={by}
				data-order={inverseOrder}
				onClick={({ target }) => onClickHandler(target.getAttribute('data-by'), target.getAttribute('data-order'))}
				disabled={isDisabled}
			/>
		)
	}
}

class App extends React.Component {
	constructor(props) {
		super(props)

		this.constants = {
			api: 'https://fhir-open.sandboxcerner.com/dstu2/0b8a0111-e8e6-4c26-a91c-5069cbc6b1ca',
			fsa: {
				default: {
					fetched: false,
					fetching: false
				},
				req: {
					fetching: true,
					fetched: false
				},
				res: {
					fetching: false,
					fetched: true
				}
			}
		};

		this.defaultAppState = {
			search: {
				...this.constants.fsa.default,
				value: '',
				data: []
			},
			selectedPatient: null,
			conditions: {
				...this.constants.fsa.default,
				data: []
			},
			filter: {
				by: null,
				order: null
			}
		};

		this.state = this.defaultAppState;
	}

	restoreState() {
		this.setState({ ...this.defaultAppState })
	}

	/**
	 * 
	 * @param {SyntheticEvent} event 
	 * @param {object} d - all props from wrapper
	 * @returns search 
	 */
	searchPatients({ target: { value }}, d) {
		const { search: prevSearchState } = this.state;

		this.setState({
			search: {
				...prevSearchState,
				value: value
			}
		}, () => {
			const { search: currentSearchState } = this.state;

			if (value.length > 3) {
				const request = new Request(`${this.constants.api}/Patient?name=${value}`, { headers: new Headers({ 'Accept': 'application/json' }) });
			
				this.setState({
					search: {
						...currentSearchState,
						fetching: true
					}
				})

				fetch(request)
					.then(response => {
						return response.json();
					})
					.then(data => {
						const { search: nextSearchState } = this.state;
						
						this.setState({
							search: {
								...nextSearchState,
								...this.constants.fsa.res,
								data: data.total === 0 ? [] : data.entry.map(datum => {
									return {
										key: datum.resource.id,
										value: datum.resource.id,
										text: datum.resource.name.filter(element => element.use === 'official')[0].text,
										birthdate: datum.resource.birthDate,
										gender: datum.resource.gender
									}
								})
							}
						})
					})
					.catch(error => {
						console.error('Error:', error)
						
						this.restoreState()
					});
			}			
		})
	}

	/**
	 * 
	 * @param {SyntheticEvent} e
	 * @param {object} data - object, all props from wrapper
	 * @returns selectedPatient and conditions 
	 */
	selectPatient(e, { value, options }) {
		const { conditions: prevConditionsState } = this.state;

		this.setState({
			selectedPatient: options.filter(option => option.value === value)[0],
			conditions: {
				...prevConditionsState,
				...this.constants.fsa.req
			},
			filter: {
				...this.defaultAppState.filter
			}
		}, () => {
			const { selectedPatient } = this.state;

			if (selectedPatient) {
				const request = new Request(`${this.constants.api}/Condition?patient=${value}`, { headers: new Headers({ 'Accept': 'application/json' }) });

				fetch(request)
					.then(response => {
						return response.json();
					})
					.then(data => {
						const { conditions: currentConditionsState } = this.state;

						this.setState({
							conditions: {
								...currentConditionsState,
								...this.constants.fsa.res,
								data: data.total === 0
									? []
									: data.entry.filter(datum => datum.resource.clinicalStatus === 'active').map(activeDatum => {
										return {
											// http://prntscr.com/m0f0pc
											text: activeDatum.resource.code.text,
											dateRecorded: activeDatum.resource.dateRecorded || '-'
										}
									})
							}
						})
					})
					.catch(error => {
						console.error('Error:', error)
						
						this.restoreState()
					});

			} else {
				this.restoreState()
			}
		})
	}

	/**
	 * 
	 * @param {string} by - text || dateRecorded
	 * @param {string} order - asc || desc
	 * @returns filter and conditions (sorted)
	 */
	filterTable(by, order) {
		const { conditions: prevConditionsState } = this.state;

		if (prevConditionsState.data.length > 1) {
			const nextConditionsData = prevConditionsState.data.sort((a, b) => {
				switch (order) {
					case 'asc':
						return a[by] > b[by] ? 1 : -1
						break;
					case 'desc':
						return a[by] < b[by] ? 1 : -1
						break;
					default:
						return 0
				}
			});

			this.setState({
				filter: {
					by: by,
					order: order
				},
				conditions: {
					...prevConditionsState,
					data: nextConditionsData
				}
			})
		}
	}

	render() {
		const { search, selectedPatient, conditions, filter } = this.state;

		const sortableColumnHeaders = [
			{
				text: 'Condition Name',
				by: 'text'
			},
			{
				text: 'Date Reported',
				by: 'dateRecorded'
			}
		]
		return (
			<Grid>
				<Grid.Row>
					<Grid.Column width={2} />
					<Grid.Column width={12}>
						<Segment>
							<Dropdown
								placeholder='Search Patients'
								onSearchChange={this.searchPatients.bind(this)}
								onChange={this.selectPatient.bind(this)}
								options={search.data}
								loading={search.fetching}
								noResultsMessage={search.value.length < 4 ? 'Begin typing to search...' : search.fetching ? 'Searching...' : 'No results found'}
								fluid search selection clearable
							/>
						</Segment>
					</Grid.Column>
					<Grid.Column width={2} />
				</Grid.Row>
				<Grid.Row>
					<Grid.Column width={2} />
					{selectedPatient &&
						<Grid.Column width={3}>
							<Segment>
								<Card>
									<Card.Content>
										<Card.Header>{selectedPatient.text}</Card.Header>
										<Card.Description>
											<p>Birth Date: {selectedPatient.birthdate}</p>
											<p>Gender: {selectedPatient.gender}</p>
										</Card.Description>
									</Card.Content>
								</Card>
							</Segment>
						</Grid.Column>
					}
					{(conditions.fetched || conditions.fetching) &&
						<Grid.Column width={9}>
							<Segment loading={conditions.fetching}>
								<Table striped>
									<Table.Header>
										<Table.Row>
											{sortableColumnHeaders.map((header, index) => {
												return (
													<Table.HeaderCell key={index}>
														{header.text}
														<FilterIcon
															isDisabled={conditions.data.length <= 1}
															by={header.by}
															order='asc'
															activeFilterState={filter}
															onClickHandler={this.filterTable.bind(this)}
														/>
													</Table.HeaderCell>
												)
											})}
											<Table.HeaderCell>PubMed Link</Table.HeaderCell>
										</Table.Row>
									</Table.Header>
									{conditions.fetched &&
										<Table.Body>
											{conditions.data.length == 0 ? (
												<Table.Row>
													<Table.Cell colSpan={3}>No Active Conditions Found</Table.Cell>
												</Table.Row>
											) : (
												<React.Fragment>
													{conditions.data.map((condition, index) => {
														return (
															<Table.Row key={index}>
																<Table.Cell>{condition.text}</Table.Cell>
																<Table.Cell>{condition.dateRecorded}</Table.Cell>
																<Table.Cell>
																	<a href={`https://www.ncbi.nlm.nih.gov/pubmed/?term=${condition.text}`} target='_blank'>
																		<Icon name='linkify' />
																	</a>
																</Table.Cell>
															</Table.Row>		
														)
													})}
												</React.Fragment>
											)}
										</Table.Body>
									}
								</Table>
							</Segment>
						</Grid.Column>
					}
					<Grid.Column width={2} />
				</Grid.Row>
			</Grid>
		)
	}
}

ReactDOM.render(
	<App />,
	document.getElementById('root')
);